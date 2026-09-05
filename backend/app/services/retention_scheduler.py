"""Runs the retention sweep once a day.

APScheduler rather than another asyncio loop: the worker's loop already exists
because it polls continuously, but this fires once daily at a fixed hour, and
hand-rolling "sleep until 04:00 local, survive a clock change, do not drift"
is exactly the wheel APScheduler is.

The job is deliberately not started when there is nothing to do — see
`should_schedule`. A scheduler that wakes every night to issue four DELETEs
that match zero rows is noise in the logs and one more thing to explain.
"""

import logging

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from apscheduler.triggers.cron import CronTrigger

from app.config import get_settings
from app.db.database import async_session_factory
from app.services.retention_service import run_retention

logger = logging.getLogger(__name__)

_scheduler: AsyncIOScheduler | None = None


async def sweep() -> None:
    """One sweep, in its own session, never raising into the scheduler.

    An exception escaping here would be swallowed by APScheduler's default
    error handling and logged without a stack trace worth reading, so it is
    caught and logged properly instead.
    """
    try:
        async with async_session_factory() as db:
            counts = await run_retention(db)
        logger.info("Retention sweep finished: %s", counts)
    except Exception:
        logger.exception("Retention sweep failed")


def start_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        return

    settings = get_settings()
    _scheduler = AsyncIOScheduler(timezone="UTC")
    _scheduler.add_job(
        sweep,
        CronTrigger(hour=settings.retention_sweep_hour, minute=0),
        id="retention-sweep",
        # A sweep that overruns must not stack up behind itself, and a missed
        # fire (process restart across the hour) should just wait for tomorrow
        # rather than running immediately at boot.
        max_instances=1,
        coalesce=True,
        misfire_grace_time=3600,
    )
    _scheduler.start()
    logger.info(
        "Retention scheduler started (daily at %02d:00 UTC, global cutoff %s)",
        settings.retention_sweep_hour,
        f"{settings.retention_days} days" if settings.retention_days else "disabled",
    )


def stop_scheduler() -> None:
    global _scheduler
    if _scheduler is not None:
        _scheduler.shutdown(wait=False)
        _scheduler = None
