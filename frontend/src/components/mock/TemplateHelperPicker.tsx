"use client";

import { useState } from "react";

interface TemplateHelperPickerProps {
  onInsert: (template: string) => void;
}

const TEMPLATE_GROUPS = [
  {
    label: "Person",
    items: [
      { template: "{{randomFirstName}}", description: "First name" },
      { template: "{{randomLastName}}", description: "Last name" },
      { template: "{{randomFullName}}", description: "Full name" },
      { template: "{{faker.email}}", description: "Email address" },
      { template: "{{randomJobTitle}}", description: "Job title" },
      { template: "{{faker.prefix}}", description: "Name prefix (Mr., Dr.)" },
      { template: "{{faker.suffix}}", description: "Name suffix (Jr., Sr.)" },
      { template: "{{faker.gender}}", description: "Gender" },
      { template: "{{faker.bio}}", description: "Short bio text" },
      { template: "{{faker.age}}", description: "Random age (18-80)" },
      { template: "{{faker.username}}", description: "Username" },
      { template: "{{faker.password}}", description: "Password string" },
    ],
  },
  {
    label: "Address",
    items: [
      { template: "{{faker.address}}", description: "Full street address" },
      { template: "{{faker.city}}", description: "City name" },
      { template: "{{faker.state}}", description: "State / province" },
      { template: "{{faker.zipCode}}", description: "Zip / postal code" },
      { template: "{{faker.country}}", description: "Country name" },
      { template: "{{faker.countryCode}}", description: "ISO country code" },
      { template: "{{faker.latitude}}", description: "Latitude coordinate" },
      { template: "{{faker.longitude}}", description: "Longitude coordinate" },
      { template: "{{faker.streetName}}", description: "Street name" },
      { template: "{{faker.buildingNumber}}", description: "Building number" },
      { template: "{{faker.timeZone}}", description: "Time zone identifier" },
    ],
  },
  {
    label: "Internet",
    items: [
      { template: "{{faker.url}}", description: "URL" },
      { template: "{{faker.domainName}}", description: "Domain name" },
      { template: "{{faker.ip}}", description: "IPv4 address" },
      { template: "{{faker.ipv6}}", description: "IPv6 address" },
      { template: "{{faker.macAddress}}", description: "MAC address" },
      { template: "{{faker.userAgent}}", description: "User agent string" },
      { template: "{{faker.color}}", description: "Hex color code" },
      { template: "{{faker.mimeType}}", description: "MIME type" },
      { template: "{{faker.protocol}}", description: "http or https" },
      { template: "{{faker.slug}}", description: "URL slug" },
      { template: "{{faker.httpMethod}}", description: "HTTP method verb" },
      { template: "{{faker.httpStatusCode}}", description: "HTTP status code" },
    ],
  },
  {
    label: "Commerce",
    items: [
      { template: "{{faker.productName}}", description: "Product name" },
      { template: "{{faker.price}}", description: "Price value" },
      { template: "{{faker.productCategory}}", description: "Product category" },
      { template: "{{faker.productDescription}}", description: "Product description" },
      { template: "{{faker.productMaterial}}", description: "Product material" },
      { template: "{{faker.productAdjective}}", description: "Product adjective" },
      { template: "{{faker.department}}", description: "Department name" },
      { template: "{{faker.isbn}}", description: "ISBN number" },
    ],
  },
  {
    label: "Company",
    items: [
      { template: "{{faker.company}}", description: "Company name" },
      { template: "{{faker.companySuffix}}", description: "Company suffix (LLC, Inc)" },
      { template: "{{faker.catchPhrase}}", description: "Catch phrase" },
      { template: "{{faker.buzzword}}", description: "Buzzword" },
      { template: "{{faker.industry}}", description: "Industry sector" },
      { template: "{{faker.ein}}", description: "Employer ID number" },
    ],
  },
  {
    label: "Finance",
    items: [
      { template: "{{faker.currencyCode}}", description: "Currency code (USD)" },
      { template: "{{faker.currencyName}}", description: "Currency name" },
      { template: "{{faker.currencySymbol}}", description: "Currency symbol" },
      { template: "{{faker.creditCardNumber}}", description: "Credit card number" },
      { template: "{{faker.creditCardCVV}}", description: "Credit card CVV" },
      { template: "{{faker.iban}}", description: "IBAN number" },
      { template: "{{faker.bic}}", description: "BIC / SWIFT code" },
      { template: "{{faker.bitcoinAddress}}", description: "Bitcoin address" },
    ],
  },
  {
    label: "Lorem",
    items: [
      { template: "{{faker.lorem}}", description: "Lorem paragraph" },
      { template: "{{faker.loremWord}}", description: "Single word" },
      { template: "{{faker.loremWords}}", description: "Multiple words" },
      { template: "{{faker.sentence}}", description: "Single sentence" },
      { template: "{{faker.paragraph}}", description: "Full paragraph" },
      { template: "{{faker.loremSlug}}", description: "Slug from lorem words" },
    ],
  },
  {
    label: "Date / Time",
    items: [
      { template: "{{now}}", description: "Current ISO datetime" },
      { template: "{{timestamp}}", description: "Unix timestamp (seconds)" },
      { template: "{{faker.pastDate}}", description: "Past date" },
      { template: "{{faker.futureDate}}", description: "Future date" },
      { template: "{{faker.recentDate}}", description: "Recent date (last few days)" },
      { template: "{{faker.month}}", description: "Month name" },
      { template: "{{faker.weekday}}", description: "Day of the week" },
      { template: "{{faker.year}}", description: "Random year" },
    ],
  },
  {
    label: "Phone",
    items: [
      { template: "{{faker.phone}}", description: "Phone number" },
      { template: "{{faker.phoneFormats}}", description: "Phone format pattern" },
      { template: "{{faker.imei}}", description: "IMEI number" },
      { template: "{{faker.phoneCode}}", description: "Country calling code" },
    ],
  },
  {
    label: "Images",
    items: [
      { template: "{{randomImage}}", description: "Random image URL" },
      { template: "{{randomAvatar}}", description: "Avatar image URL" },
      { template: "{{randomImageUrl}}", description: "Placeholder image URL" },
      { template: "{{randomPlaceholder}}", description: "Placeholder image (custom size)" },
    ],
  },
  {
    label: "System",
    items: [
      { template: "{{faker.fileName}}", description: "File name with extension" },
      { template: "{{faker.fileExtension}}", description: "File extension" },
      { template: "{{faker.filePath}}", description: "File system path" },
      { template: "{{faker.semver}}", description: "Semantic version (1.2.3)" },
      { template: "{{faker.commonFileType}}", description: "Common file type" },
      { template: "{{faker.directoryPath}}", description: "Directory path" },
    ],
  },
  {
    label: "Database",
    items: [
      { template: "{{faker.dbColumn}}", description: "Database column name" },
      { template: "{{faker.dbType}}", description: "Database column type" },
      { template: "{{faker.dbEngine}}", description: "Database engine" },
      { template: "{{faker.dbCollation}}", description: "Database collation" },
    ],
  },
  {
    label: "Vehicle",
    items: [
      { template: "{{faker.vehicle}}", description: "Vehicle name" },
      { template: "{{faker.vehicleType}}", description: "Vehicle type" },
      { template: "{{faker.vehicleManufacturer}}", description: "Manufacturer" },
      { template: "{{faker.vehicleModel}}", description: "Model name" },
      { template: "{{faker.vin}}", description: "Vehicle identification number" },
      { template: "{{faker.vehicleFuel}}", description: "Fuel type" },
    ],
  },
  {
    label: "Request",
    items: [
      { template: "{{request.body.field}}", description: "Request body field" },
      { template: "{{request.query.param}}", description: "Query parameter" },
      { template: "{{request.params.id}}", description: "URL path parameter" },
      { template: "{{request.headers.key}}", description: "Request header" },
      { template: "{{request.method}}", description: "HTTP method" },
      { template: "{{request.url}}", description: "Full request URL" },
    ],
  },
  {
    label: "Core",
    items: [
      { template: "{{randomUUID}}", description: "UUID v4" },
      { template: "{{randomInt 1 100}}", description: "Random integer in range" },
      { template: "{{randomFloat 0 1}}", description: "Random float in range" },
      { template: "{{randomString 10}}", description: "Random alphanumeric string" },
      { template: "{{randomBool}}", description: "Random true / false" },
      { template: "{{now}}", description: "Current ISO datetime" },
      { template: "{{timestamp}}", description: "Unix timestamp" },
      { template: "{{oneOf 'a' 'b' 'c'}}", description: "Pick one value at random" },
      { template: "{{repeat 3}}", description: "Repeat block N times" },
    ],
  },
];

export function TemplateHelperPicker({ onInsert }: TemplateHelperPickerProps) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);
  const [search, setSearch] = useState("");

  const filteredGroups = TEMPLATE_GROUPS.map((group) => {
    if (!search.trim()) return group;
    const q = search.toLowerCase();
    const matchedItems = group.items.filter(
      (item) =>
        item.template.toLowerCase().includes(q) ||
        item.description.toLowerCase().includes(q)
    );
    return { ...group, items: matchedItems };
  }).filter((group) => group.items.length > 0);

  return (
    <div className="rounded-xl border border-slate-200/60 bg-white shadow-sm overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100">
        <h4 className="text-xs font-semibold text-slate-500 uppercase tracking-wider flex items-center gap-2">
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg" className="text-indigo-400">
            <path d="M5 2L3 7l2 5M9 2l2 5-2 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Template Helpers
        </h4>
      </div>

      {/* Search */}
      <div className="px-3 pt-3 pb-1">
        <div className="relative">
          <svg
            width="14"
            height="14"
            viewBox="0 0 14 14"
            fill="none"
            xmlns="http://www.w3.org/2000/svg"
            className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400"
          >
            <circle cx="6" cy="6" r="4.5" stroke="currentColor" strokeWidth="1.3" />
            <path d="M9.5 9.5l3 3" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search helpers..."
            className="w-full pl-8 pr-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-base placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-400 transition-colors duration-200"
          />
        </div>
      </div>

      <div className="max-h-[300px] lg:max-h-[420px] overflow-y-auto">
        {filteredGroups.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <p className="text-xs text-slate-400">No helpers match your search.</p>
          </div>
        ) : (
          filteredGroups.map((group) => (
            <div key={group.label} className="border-b border-slate-100 last:border-b-0">
              <button
                onClick={() =>
                  setExpandedGroup(expandedGroup === group.label ? null : group.label)
                }
                className="w-full flex items-center justify-between px-4 py-2.5 text-base font-medium text-slate-700 hover:bg-slate-50 transition-colors duration-150"
              >
                <span className="flex items-center gap-2">
                  {group.label}
                  <span className="text-[10px] text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded-full font-normal">
                    {group.items.length}
                  </span>
                </span>
                <svg
                  width="14"
                  height="14"
                  viewBox="0 0 14 14"
                  fill="none"
                  xmlns="http://www.w3.org/2000/svg"
                  className={`text-slate-400 transition-transform duration-200 ${
                    expandedGroup === group.label ? "rotate-180" : ""
                  }`}
                >
                  <path d="M4 5.5l3 3 3-3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
                </svg>
              </button>
              {(expandedGroup === group.label || search.trim()) && (
                <div className="px-2 pb-2 space-y-0.5">
                  {group.items.map((item) => (
                    <button
                      key={item.template}
                      onClick={() => onInsert(item.template)}
                      className="w-full text-left px-3 py-2 rounded-lg hover:bg-indigo-50 transition-colors duration-150 group"
                    >
                      <code className="text-sm font-mono bg-slate-100 group-hover:bg-indigo-100 text-indigo-600 group-hover:text-indigo-700 px-1.5 py-0.5 rounded transition-colors duration-150">
                        {item.template}
                      </code>
                      <p className="text-sm text-slate-400 mt-1 ml-0.5">{item.description}</p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
