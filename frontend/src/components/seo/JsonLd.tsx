/**
 * Renders a JSON-LD block.
 *
 * The `<` escaping matters: JSON.stringify will happily emit the characters
 * `</script>` if they ever appear in a string value, which would close the tag
 * early and turn the rest of the payload into markup. Everything passed in
 * here is static today, but the escape means that stays safe if any of it ever
 * becomes data-driven.
 */
export function JsonLd({ data }: { data: Record<string, unknown> }) {
  return (
    <script
      type="application/ld+json"
      dangerouslySetInnerHTML={{
        __html: JSON.stringify(data).replace(/</g, "\\u003c"),
      }}
    />
  );
}

// Stable identifiers so the Organization on every page and the
// SoftwareApplication on the homepage resolve to one entity rather than
// looking like several unrelated things that happen to share a name.
export const SITE_URL = "https://mocklane.com";
export const ORG_ID = `${SITE_URL}/#organization`;
export const SOFTWARE_ID = `${SITE_URL}/#software`;
