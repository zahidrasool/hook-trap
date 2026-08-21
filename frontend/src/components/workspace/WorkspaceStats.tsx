interface WorkspaceStatsProps {
  mockCount: number;
  memberCount: number;
}

export function WorkspaceStats({ mockCount, memberCount }: WorkspaceStatsProps) {
  const stats = [
    {
      label: "Mock Endpoints",
      value: mockCount,
      iconBg: "bg-indigo-50",
      iconColor: "text-indigo-500",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M17.25 6.75L22.5 12l-5.25 5.25m-10.5 0L1.5 12l5.25-5.25m7.5-3l-4.5 16.5" />
        </svg>
      ),
    },
    {
      label: "Team Members",
      value: memberCount,
      iconBg: "bg-violet-50",
      iconColor: "text-violet-500",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 002.625.372 9.337 9.337 0 004.121-.952 4.125 4.125 0 00-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 018.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0111.964-3.07M12 6.375a3.375 3.375 0 11-6.75 0 3.375 3.375 0 016.75 0zm8.25 2.25a2.625 2.625 0 11-5.25 0 2.625 2.625 0 015.25 0z" />
        </svg>
      ),
    },
    {
      label: "Requests Today",
      value: "-",
      iconBg: "bg-blue-50",
      iconColor: "text-blue-500",
      icon: (
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
        </svg>
      ),
    },
  ];

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
      {stats.map((stat) => (
        <div
          key={stat.label}
          className="bg-white rounded-xl border border-slate-200/60 shadow-sm p-6 flex items-center gap-4"
        >
          <div className={`${stat.iconBg} ${stat.iconColor} rounded-xl p-2.5`}>
            {stat.icon}
          </div>
          <div>
            <p className="text-base text-slate-500 font-medium">{stat.label}</p>
            <p className="text-3xl font-bold text-slate-900 tracking-tight">{stat.value}</p>
          </div>
        </div>
      ))}
    </div>
  );
}
