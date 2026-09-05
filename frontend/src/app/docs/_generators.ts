/* The generator catalogue rendered in the Mock APIs reference.
 *
 * Plain data, kept out of _components.tsx deliberately: that module is a
 * client boundary, and an array imported across it becomes a client reference
 * that a server component cannot iterate. Keeping the data here lets the
 * reference table server-render.
 *
 * The count here must match GENERATOR_REGISTRY in
 * backend/app/services/template_engine.py, which has 121 entries.
 */

export const GENERATORS = [
  {
    name: "Identity",
    items: [
      ["{{faker.firstName}}", "Emma"],
      ["{{faker.lastName}}", "Johnson"],
      ["{{faker.fullName}}", "Emma Johnson"],
      ["{{faker.email}}", "emma@example.com"],
      ["{{faker.username}}", "emma_j92"],
      ["{{faker.phone}}", "+1-555-0142"],
      ["{{faker.avatar}}", "https://i.pravatar.cc/150?u=..."],
    ],
  },
  {
    name: "Location",
    items: [
      ["{{faker.city}}", "San Francisco"],
      ["{{faker.country}}", "United States"],
      ["{{faker.address}}", "123 Main St"],
      ["{{faker.zipCode}}", "94102"],
      ["{{faker.latitude}}", "37.7749"],
      ["{{faker.longitude}}", "-122.4194"],
    ],
  },
  {
    name: "Internet",
    items: [
      ["{{faker.url}}", "https://example.com/page"],
      ["{{faker.domain}}", "example.com"],
      ["{{faker.ipv4}}", "192.168.1.42"],
      ["{{faker.ipv6}}", "2001:0db8:85a3:..."],
      ["{{faker.userAgent}}", "Mozilla/5.0 ..."],
      ["{{faker.slug}}", "my-awesome-post"],
    ],
  },
  {
    name: "Numbers & IDs",
    items: [
      ["{{randomUUID}}", "550e8400-e29b-41d4-..."],
      ["{{randomInt 1 1000}}", "42"],
      ["{{randomFloat 0 100 2}}", "73.25"],
      ["{{autoIncrement}}", "1, 2, 3, ..."],
    ],
  },
  {
    name: "Date & Time",
    items: [
      ["{{now}}", "2026-04-12T10:30:00Z"],
      ["{{faker.pastDate}}", "2025-08-14"],
      ["{{faker.futureDate}}", "2027-01-20"],
      ["{{faker.timestamp}}", "1744468200"],
    ],
  },
  {
    name: "Commerce",
    items: [
      ["{{faker.price}}", "29.99"],
      ["{{faker.productName}}", "Wireless Headphones"],
      ["{{faker.companyName}}", "Acme Corp"],
      ["{{faker.currencyCode}}", "USD"],
    ],
  },
  {
    name: "Text",
    items: [
      ["{{faker.word}}", "synergy"],
      ["{{faker.sentence}}", "The quick brown fox..."],
      ["{{faker.paragraph}}", "Lorem ipsum dolor sit..."],
      ["{{faker.title}}", "Senior Developer"],
    ],
  },
  {
    name: "Color & Media",
    items: [
      ["{{faker.hexColor}}", "#3B82F6"],
      ["{{faker.rgbColor}}", "rgb(59, 130, 246)"],
      ["{{faker.imageUrl}}", "https://picsum.photos/..."],
      ["{{faker.mimeType}}", "application/json"],
    ],
  },
];
