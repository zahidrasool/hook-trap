import re
import uuid
import random
import time
import string
import hashlib
from datetime import datetime, timezone, timedelta
from faker import Faker

fake = Faker()

TEMPLATE_PATTERN = re.compile(r'\{\{(.+?)\}\}')

# ---------------------------------------------------------------------------
# Hardcoded fallback lists for Faker methods that don't exist
# ---------------------------------------------------------------------------
_DISHES = [
    "Spaghetti Carbonara", "Chicken Tikka Masala", "Beef Stroganoff",
    "Pad Thai", "Sushi Roll", "Fish and Chips", "Tacos al Pastor",
    "Ratatouille", "Biryani", "Pho", "Lasagna", "Falafel Wrap",
    "Eggs Benedict", "Ceviche", "Moussaka", "Goulash", "Paella",
]
_INGREDIENTS = [
    "flour", "sugar", "salt", "butter", "olive oil", "garlic", "onion",
    "pepper", "eggs", "milk", "cream", "tomato", "basil", "oregano",
    "cinnamon", "vanilla", "lemon", "ginger", "soy sauce", "vinegar",
]
_SPICES = [
    "cumin", "paprika", "turmeric", "coriander", "cardamom", "nutmeg",
    "cinnamon", "cayenne", "saffron", "cloves", "fennel", "star anise",
    "black pepper", "white pepper", "chili flakes", "mustard seed",
]
_FRUITS = [
    "apple", "banana", "orange", "strawberry", "blueberry", "mango",
    "pineapple", "grape", "watermelon", "peach", "kiwi", "lemon",
    "cherry", "pear", "plum", "fig", "pomegranate", "raspberry",
]
_VEGETABLES = [
    "carrot", "broccoli", "spinach", "potato", "tomato", "cucumber",
    "bell pepper", "onion", "garlic", "lettuce", "kale", "zucchini",
    "cauliflower", "celery", "mushroom", "asparagus", "corn", "peas",
]
_MUSIC_GENRES = [
    "Rock", "Pop", "Jazz", "Blues", "Classical", "Hip Hop", "R&B",
    "Country", "Electronic", "Reggae", "Metal", "Folk", "Punk",
    "Soul", "Funk", "Latin", "Indie", "Alternative", "Gospel",
]
_ANIMALS = [
    "dog", "cat", "elephant", "lion", "tiger", "bear", "wolf", "eagle",
    "dolphin", "whale", "shark", "penguin", "giraffe", "zebra", "monkey",
    "rabbit", "fox", "deer", "horse", "owl", "parrot", "turtle", "snake",
]
_INDUSTRIES = [
    "Technology", "Healthcare", "Finance", "Education", "Manufacturing",
    "Retail", "Real Estate", "Energy", "Telecommunications", "Media",
    "Transportation", "Agriculture", "Construction", "Hospitality",
    "Pharmaceuticals", "Aerospace", "Automotive", "Insurance",
]
_STOCK_TICKERS = [
    "AAPL", "GOOGL", "MSFT", "AMZN", "TSLA", "META", "NVDA", "NFLX",
    "JPM", "V", "MA", "DIS", "PYPL", "INTC", "AMD", "CRM", "ORCL",
    "IBM", "CSCO", "UBER", "SQ", "SHOP", "SPOT", "ZM", "SNAP",
]
_PRONOUNS = [
    "he/him", "she/her", "they/them", "he/they", "she/they", "ze/zir",
]
_HTTP_METHODS = ["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]
_PROTOCOLS = ["http", "https", "ftp", "ssh", "ws", "wss"]
_MIME_TYPES = [
    "application/json", "text/html", "text/plain", "application/xml",
    "image/png", "image/jpeg", "application/pdf", "text/css",
    "application/javascript", "multipart/form-data", "application/octet-stream",
]
_FILE_EXTENSIONS = [
    "txt", "pdf", "doc", "docx", "xls", "xlsx", "csv", "json", "xml",
    "html", "css", "js", "py", "java", "cpp", "png", "jpg", "gif",
    "mp3", "mp4", "zip", "tar", "gz", "svg", "md", "yaml", "toml",
]
_ELEMENTS = [
    "Hydrogen", "Helium", "Lithium", "Beryllium", "Boron", "Carbon",
    "Nitrogen", "Oxygen", "Fluorine", "Neon", "Sodium", "Magnesium",
    "Aluminum", "Silicon", "Phosphorus", "Sulfur", "Chlorine", "Argon",
    "Potassium", "Calcium", "Iron", "Copper", "Zinc", "Silver", "Gold",
]
_UNITS = [
    "meter", "kilogram", "second", "ampere", "kelvin", "mole", "candela",
    "hertz", "newton", "pascal", "joule", "watt", "volt", "ohm", "farad",
]
_CRYPTO_CURRENCIES = [
    "Bitcoin", "Ethereum", "Ripple", "Litecoin", "Cardano", "Polkadot",
    "Chainlink", "Stellar", "Dogecoin", "Solana", "Avalanche", "Polygon",
]
_VEHICLE_MANUFACTURERS = [
    "Toyota", "Ford", "Honda", "BMW", "Mercedes-Benz", "Audi",
    "Chevrolet", "Volkswagen", "Tesla", "Hyundai", "Kia", "Nissan",
    "Subaru", "Mazda", "Volvo", "Porsche", "Lexus", "Jaguar",
]
_VEHICLE_MODELS = [
    "Camry", "Mustang", "Civic", "3 Series", "C-Class", "A4",
    "Model 3", "Corolla", "Accord", "Golf", "Tucson", "Sportage",
    "Outback", "CX-5", "XC90", "911", "RX", "F-Type",
]

# ---------------------------------------------------------------------------
# GENERATOR_REGISTRY: shorthand name -> callable returning a value
# ---------------------------------------------------------------------------
GENERATOR_REGISTRY: dict[str, callable] = {
    # ── Person ──────────────────────────────────────────────────────────
    "randomFirstName":      lambda: fake.first_name(),
    "randomLastName":       lambda: fake.last_name(),
    "randomFullName":       lambda: fake.name(),
    "randomPrefix":         lambda: fake.prefix(),
    "randomSuffix":         lambda: fake.suffix(),
    "randomJobTitle":       lambda: fake.job(),
    "randomJobArea":        lambda: fake.job(),
    "randomGender":         lambda: random.choice(["Male", "Female", "Non-binary"]),
    "randomDateOfBirth":    lambda: fake.date_of_birth(minimum_age=18, maximum_age=80).isoformat(),
    "randomSSN":            lambda: fake.ssn(),
    "randomUsername":        lambda: fake.user_name(),
    "randomPassword":        lambda: fake.password(),
    "randomBio":            lambda: fake.sentence(nb_words=12),
    "randomPronouns":       lambda: random.choice(_PRONOUNS),
    "randomBloodGroup":     lambda: random.choice(["A+", "A-", "B+", "B-", "AB+", "AB-", "O+", "O-"]),

    # ── Address ─────────────────────────────────────────────────────────
    "randomAddress":        lambda: fake.address().replace("\n", ", "),
    "randomCity":           lambda: fake.city(),
    "randomState":          lambda: fake.state(),
    "randomCountry":        lambda: fake.country(),
    "randomZipCode":        lambda: fake.zipcode(),
    "randomStreet":         lambda: fake.street_address(),
    "randomLatitude":       lambda: str(fake.latitude()),
    "randomLongitude":      lambda: str(fake.longitude()),
    "randomCountryCode":    lambda: fake.country_code(),
    "randomTimezone":       lambda: fake.timezone(),
    "randomBuildingNumber": lambda: fake.building_number(),
    "randomStateAbbr":      lambda: fake.state_abbr(),

    # ── Internet ────────────────────────────────────────────────────────
    "randomEmail":          lambda: fake.email(),
    "randomDomainName":     lambda: fake.domain_name(),
    "randomUrl":            lambda: fake.url(),
    "randomIPv4":           lambda: fake.ipv4(),
    "randomIPv6":           lambda: fake.ipv6(),
    "randomMacAddress":     lambda: fake.mac_address(),
    "randomUserAgent":      lambda: fake.user_agent(),
    "randomSlug":           lambda: fake.slug(),
    "randomProtocol":       lambda: random.choice(_PROTOCOLS),
    "randomHttpMethod":     lambda: random.choice(_HTTP_METHODS),
    "randomMimeType":       lambda: random.choice(_MIME_TYPES),
    "randomPort":           lambda: random.randint(1024, 65535),
    "randomInternetUsername": lambda: fake.user_name(),
    "randomInternetPassword": lambda: fake.password(),
    "randomHashtag":        lambda: f"#{fake.word()}",

    # ── Commerce ────────────────────────────────────────────────────────
    "randomPrice":          lambda: f"{random.uniform(0.99, 999.99):.2f}",
    "randomProductName":    lambda: fake.catch_phrase(),
    "randomDepartment":     lambda: random.choice([
        "Electronics", "Clothing", "Books", "Home & Garden", "Sports",
        "Toys", "Automotive", "Health", "Beauty", "Grocery",
    ]),
    "randomColor":          lambda: fake.color_name(),
    "randomColorHex":       lambda: fake.hex_color(),
    "randomColorRGB":       lambda: f"rgb({random.randint(0,255)}, {random.randint(0,255)}, {random.randint(0,255)})",
    "randomBarcode":        lambda: fake.ean13(),
    "randomCurrency":       lambda: fake.currency_name(),
    "randomCurrencyCode":   lambda: fake.currency_code(),
    "randomCurrencySymbol": lambda: fake.currency_symbol(),

    # ── Company ─────────────────────────────────────────────────────────
    "randomCompanyName":    lambda: fake.company(),
    "randomCatchPhrase":    lambda: fake.catch_phrase(),
    "randomBs":             lambda: fake.bs(),
    "randomIndustry":       lambda: random.choice(_INDUSTRIES),
    "randomCompanySuffix":  lambda: fake.company_suffix(),
    "randomEIN":            lambda: f"{random.randint(10,99)}-{random.randint(1000000,9999999)}",
    "randomDUNS":           lambda: f"{random.randint(10,99)}-{random.randint(100,999)}-{random.randint(1000,9999)}",

    # ── Finance ─────────────────────────────────────────────────────────
    "randomCreditCard":     lambda: fake.credit_card_number(),
    "randomCreditCardProvider": lambda: fake.credit_card_provider(),
    "randomIBAN":           lambda: fake.iban(),
    "randomBIC":            lambda: fake.swift(),
    "randomBitcoinAddress": lambda: fake.md5()[:34],
    "randomEthereumAddress": lambda: "0x" + fake.sha1()[:40],
    "randomCryptoCurrency": lambda: random.choice(_CRYPTO_CURRENCIES),
    "randomStockTicker":    lambda: random.choice(_STOCK_TICKERS),
    "randomAccountNumber":  lambda: fake.bban(),
    "randomRoutingNumber":  lambda: str(random.randint(100000000, 999999999)),

    # ── Lorem ───────────────────────────────────────────────────────────
    "randomWord":           lambda: fake.word(),
    "randomWords":          lambda: " ".join(fake.words(nb=5)),
    "randomSentence":       lambda: fake.sentence(),
    "randomSentences":      lambda: " ".join(fake.sentences(nb=3)),
    "randomParagraph":      lambda: fake.paragraph(),
    "randomParagraphs":     lambda: "\n\n".join(fake.paragraphs(nb=3)),
    "randomText":           lambda: fake.text(max_nb_chars=200),
    "randomLoremSlug":      lambda: fake.slug(),

    # ── Date/Time ───────────────────────────────────────────────────────
    "randomPastDate":       lambda: fake.past_date().isoformat(),
    "randomFutureDate":     lambda: fake.future_date().isoformat(),
    "randomRecentDate":     lambda: fake.date_between(start_date="-30d", end_date="today").isoformat(),
    "randomMonth":          lambda: fake.month_name(),
    "randomDayOfWeek":      lambda: fake.day_of_week(),
    "randomYear":           lambda: str(random.randint(1970, 2030)),
    "randomTime":           lambda: fake.time(),
    "randomDateTimezone":   lambda: fake.timezone(),
    "randomUnixTimestamp":  lambda: random.randint(0, int(time.time())),
    "randomISO8601":        lambda: fake.iso8601(),

    # ── Phone ───────────────────────────────────────────────────────────
    "randomPhoneNumber":    lambda: fake.phone_number(),
    "randomCountryCallingCode": lambda: f"+{random.choice([1,7,20,27,30,31,32,33,34,36,39,40,41,43,44,45,46,47,48,49,51,52,53,54,55,56,57,58,60,61,62,63,64,65,66,81,82,84,86,90,91,92,93,94,95,98,212,213,216,218,220,221])}",
    "randomIMEI":           lambda: "".join([str(random.randint(0, 9)) for _ in range(15)]),
    "randomPhoneCountryCode": lambda: fake.country_calling_code(),
    "randomMSISDN":         lambda: fake.msisdn(),

    # ── Science ─────────────────────────────────────────────────────────
    "randomElement":        lambda: random.choice(_ELEMENTS),
    "randomUnit":           lambda: random.choice(_UNITS),
    "randomAtomicNumber":   lambda: random.randint(1, 118),
    "randomChemicalFormula": lambda: random.choice(["H2O", "CO2", "NaCl", "C6H12O6", "H2SO4", "CH4", "NH3", "O2", "N2", "Fe2O3"]),
    "randomPlanet":         lambda: random.choice(["Mercury", "Venus", "Earth", "Mars", "Jupiter", "Saturn", "Uranus", "Neptune"]),

    # ── Vehicle ─────────────────────────────────────────────────────────
    "randomVehicle":        lambda: f"{random.choice(_VEHICLE_MANUFACTURERS)} {random.choice(_VEHICLE_MODELS)}",
    "randomManufacturer":   lambda: random.choice(_VEHICLE_MANUFACTURERS),
    "randomModel":          lambda: random.choice(_VEHICLE_MODELS),
    "randomVIN":            lambda: "".join(random.choices(string.ascii_uppercase + string.digits, k=17)),
    "randomLicensePlate":   lambda: fake.license_plate(),

    # ── Food ────────────────────────────────────────────────────────────
    "randomDish":           lambda: random.choice(_DISHES),
    "randomIngredient":     lambda: random.choice(_INGREDIENTS),
    "randomSpice":          lambda: random.choice(_SPICES),
    "randomFruit":          lambda: random.choice(_FRUITS),
    "randomVegetable":      lambda: random.choice(_VEGETABLES),

    # ── Music ───────────────────────────────────────────────────────────
    "randomMusicGenre":     lambda: random.choice(_MUSIC_GENRES),
    "randomSongName":       lambda: f"{fake.word().title()} {fake.word().title()}",
    "randomArtist":         lambda: fake.name(),

    # ── Animal ──────────────────────────────────────────────────────────
    "randomAnimal":         lambda: random.choice(_ANIMALS),
    "randomAnimalEmoji":    lambda: random.choice(["🐶","🐱","🐭","🐹","🐰","🦊","🐻","🐼","🐨","🐯","🦁","🐮","🐷"]),
    "randomPetName":        lambda: fake.first_name(),

    # ── System ──────────────────────────────────────────────────────────
    "randomFileName":       lambda: fake.file_name(),
    "randomFileExtension":  lambda: random.choice(_FILE_EXTENSIONS),
    "randomFilePath":       lambda: fake.file_path(),
    "randomSemver":         lambda: f"{random.randint(0,9)}.{random.randint(0,20)}.{random.randint(0,50)}",
    "randomMD5":            lambda: fake.md5(),
    "randomSHA1":           lambda: fake.sha1(),
    "randomSHA256":         lambda: fake.sha256(),
    "randomUUID4":          lambda: str(uuid.uuid4()),
}

# ---------------------------------------------------------------------------
# Category metadata (for the /template-helpers endpoint)
# ---------------------------------------------------------------------------
_REGISTRY_CATEGORIES: dict[str, list[str]] = {
    "Person": [
        "randomFirstName", "randomLastName", "randomFullName", "randomPrefix",
        "randomSuffix", "randomJobTitle", "randomJobArea", "randomGender",
        "randomDateOfBirth", "randomSSN", "randomUsername", "randomPassword",
        "randomBio", "randomPronouns", "randomBloodGroup",
    ],
    "Address": [
        "randomAddress", "randomCity", "randomState", "randomCountry",
        "randomZipCode", "randomStreet", "randomLatitude", "randomLongitude",
        "randomCountryCode", "randomTimezone", "randomBuildingNumber",
        "randomStateAbbr",
    ],
    "Internet": [
        "randomEmail", "randomDomainName", "randomUrl", "randomIPv4",
        "randomIPv6", "randomMacAddress", "randomUserAgent", "randomSlug",
        "randomProtocol", "randomHttpMethod", "randomMimeType", "randomPort",
        "randomInternetUsername", "randomInternetPassword", "randomHashtag",
    ],
    "Commerce": [
        "randomPrice", "randomProductName", "randomDepartment", "randomColor",
        "randomColorHex", "randomColorRGB", "randomBarcode", "randomCurrency",
        "randomCurrencyCode", "randomCurrencySymbol",
    ],
    "Company": [
        "randomCompanyName", "randomCatchPhrase", "randomBs", "randomIndustry",
        "randomCompanySuffix", "randomEIN", "randomDUNS",
    ],
    "Finance": [
        "randomCreditCard", "randomCreditCardProvider", "randomIBAN",
        "randomBIC", "randomBitcoinAddress", "randomEthereumAddress",
        "randomCryptoCurrency", "randomStockTicker", "randomAccountNumber",
        "randomRoutingNumber",
    ],
    "Lorem": [
        "randomWord", "randomWords", "randomSentence", "randomSentences",
        "randomParagraph", "randomParagraphs", "randomText", "randomLoremSlug",
    ],
    "Date/Time": [
        "randomPastDate", "randomFutureDate", "randomRecentDate", "randomMonth",
        "randomDayOfWeek", "randomYear", "randomTime", "randomDateTimezone",
        "randomUnixTimestamp", "randomISO8601",
    ],
    "Phone": [
        "randomPhoneNumber", "randomCountryCallingCode", "randomIMEI",
        "randomPhoneCountryCode", "randomMSISDN",
    ],
    "Science": [
        "randomElement", "randomUnit", "randomAtomicNumber",
        "randomChemicalFormula", "randomPlanet",
    ],
    "Vehicle": [
        "randomVehicle", "randomManufacturer", "randomModel", "randomVIN",
        "randomLicensePlate",
    ],
    "Food": [
        "randomDish", "randomIngredient", "randomSpice", "randomFruit",
        "randomVegetable",
    ],
    "Music": [
        "randomMusicGenre", "randomSongName", "randomArtist",
    ],
    "Animal": [
        "randomAnimal", "randomAnimalEmoji", "randomPetName",
    ],
    "System": [
        "randomFileName", "randomFileExtension", "randomFilePath",
        "randomSemver", "randomMD5", "randomSHA1", "randomSHA256", "randomUUID4",
    ],
}

_GENERATOR_DESCRIPTIONS: dict[str, str] = {
    # Person
    "randomFirstName":      "Random first name",
    "randomLastName":       "Random last name",
    "randomFullName":       "Random full name (first + last)",
    "randomPrefix":         "Name prefix (Mr., Mrs., Dr., etc.)",
    "randomSuffix":         "Name suffix (Jr., Sr., PhD, etc.)",
    "randomJobTitle":       "Random job title",
    "randomJobArea":        "Random job area/field",
    "randomGender":         "Random gender",
    "randomDateOfBirth":    "Random date of birth (ISO format)",
    "randomSSN":            "Random Social Security Number",
    "randomUsername":        "Random username",
    "randomPassword":        "Random password",
    "randomBio":            "Random short biography sentence",
    "randomPronouns":       "Random pronoun set (e.g. he/him)",
    "randomBloodGroup":     "Random blood group (e.g. A+, O-)",
    # Address
    "randomAddress":        "Full random address",
    "randomCity":           "Random city name",
    "randomState":          "Random US state name",
    "randomCountry":        "Random country name",
    "randomZipCode":        "Random zip/postal code",
    "randomStreet":         "Random street address",
    "randomLatitude":       "Random latitude coordinate",
    "randomLongitude":      "Random longitude coordinate",
    "randomCountryCode":    "Random 2-letter country code",
    "randomTimezone":       "Random timezone string",
    "randomBuildingNumber": "Random building number",
    "randomStateAbbr":      "Random US state abbreviation",
    # Internet
    "randomEmail":          "Random email address",
    "randomDomainName":     "Random domain name",
    "randomUrl":            "Random URL",
    "randomIPv4":           "Random IPv4 address",
    "randomIPv6":           "Random IPv6 address",
    "randomMacAddress":     "Random MAC address",
    "randomUserAgent":      "Random browser user agent string",
    "randomSlug":           "Random URL slug",
    "randomProtocol":       "Random protocol (http, https, ftp, etc.)",
    "randomHttpMethod":     "Random HTTP method (GET, POST, etc.)",
    "randomMimeType":       "Random MIME type",
    "randomPort":           "Random port number (1024-65535)",
    "randomInternetUsername": "Random internet username",
    "randomInternetPassword": "Random internet password",
    "randomHashtag":        "Random hashtag",
    # Commerce
    "randomPrice":          "Random price (0.99 - 999.99)",
    "randomProductName":    "Random product name",
    "randomDepartment":     "Random store department",
    "randomColor":          "Random color name",
    "randomColorHex":       "Random hex color code",
    "randomColorRGB":       "Random RGB color value",
    "randomBarcode":        "Random EAN-13 barcode",
    "randomCurrency":       "Random currency name",
    "randomCurrencyCode":   "Random currency code (USD, EUR, etc.)",
    "randomCurrencySymbol": "Random currency symbol ($, etc.)",
    # Company
    "randomCompanyName":    "Random company name",
    "randomCatchPhrase":    "Random company catch phrase",
    "randomBs":             "Random company buzzword phrase",
    "randomIndustry":       "Random industry name",
    "randomCompanySuffix":  "Random company suffix (Inc, LLC, etc.)",
    "randomEIN":            "Random Employer Identification Number",
    "randomDUNS":           "Random DUNS number",
    # Finance
    "randomCreditCard":     "Random credit card number",
    "randomCreditCardProvider": "Random credit card provider name",
    "randomIBAN":           "Random IBAN",
    "randomBIC":            "Random BIC/SWIFT code",
    "randomBitcoinAddress": "Random Bitcoin-like address",
    "randomEthereumAddress": "Random Ethereum-like address",
    "randomCryptoCurrency": "Random cryptocurrency name",
    "randomStockTicker":    "Random stock ticker symbol",
    "randomAccountNumber":  "Random bank account number",
    "randomRoutingNumber":  "Random routing number",
    # Lorem
    "randomWord":           "Random word",
    "randomWords":          "Random words (space-separated)",
    "randomSentence":       "Random sentence",
    "randomSentences":      "Multiple random sentences",
    "randomParagraph":      "Random paragraph",
    "randomParagraphs":     "Multiple random paragraphs",
    "randomText":           "Random text block (~200 chars)",
    "randomLoremSlug":      "Random lorem slug",
    # Date/Time
    "randomPastDate":       "Random date in the past (ISO format)",
    "randomFutureDate":     "Random date in the future (ISO format)",
    "randomRecentDate":     "Random date within the last 30 days",
    "randomMonth":          "Random month name",
    "randomDayOfWeek":      "Random day of the week",
    "randomYear":           "Random year (1970-2030)",
    "randomTime":           "Random time (HH:MM:SS)",
    "randomDateTimezone":   "Random timezone string",
    "randomUnixTimestamp":  "Random Unix timestamp",
    "randomISO8601":        "Random ISO 8601 datetime string",
    # Phone
    "randomPhoneNumber":    "Random phone number",
    "randomCountryCallingCode": "Random country calling code",
    "randomIMEI":           "Random 15-digit IMEI number",
    "randomPhoneCountryCode": "Random phone country code",
    "randomMSISDN":         "Random MSISDN number",
    # Science
    "randomElement":        "Random chemical element name",
    "randomUnit":           "Random SI unit name",
    "randomAtomicNumber":   "Random atomic number (1-118)",
    "randomChemicalFormula": "Random chemical formula",
    "randomPlanet":         "Random planet in the solar system",
    # Vehicle
    "randomVehicle":        "Random vehicle (manufacturer + model)",
    "randomManufacturer":   "Random vehicle manufacturer",
    "randomModel":          "Random vehicle model",
    "randomVIN":            "Random 17-character VIN",
    "randomLicensePlate":   "Random license plate number",
    # Food
    "randomDish":           "Random dish name",
    "randomIngredient":     "Random cooking ingredient",
    "randomSpice":          "Random spice name",
    "randomFruit":          "Random fruit name",
    "randomVegetable":      "Random vegetable name",
    # Music
    "randomMusicGenre":     "Random music genre",
    "randomSongName":       "Random song name",
    "randomArtist":         "Random artist name",
    # Animal
    "randomAnimal":         "Random animal name",
    "randomAnimalEmoji":    "Random animal emoji",
    "randomPetName":        "Random pet name",
    # System
    "randomFileName":       "Random file name with extension",
    "randomFileExtension":  "Random file extension",
    "randomFilePath":       "Random file path",
    "randomSemver":         "Random semantic version (x.y.z)",
    "randomMD5":            "Random MD5 hash",
    "randomSHA1":           "Random SHA-1 hash",
    "randomSHA256":         "Random SHA-256 hash",
    "randomUUID4":          "Random UUID v4",
}


# ---------------------------------------------------------------------------
# Template processing
# ---------------------------------------------------------------------------

def process_template(template: str | None, context: dict) -> str:
    """Process a response body template, replacing {{variables}} with values."""
    if not template:
        return ""

    def replacer(match):
        expression = match.group(1).strip()
        return str(evaluate_expression(expression, context))

    return TEMPLATE_PATTERN.sub(replacer, template)


def process_template_dict(headers: dict | None, context: dict) -> dict:
    """Process template variables in a dictionary of headers."""
    if not headers:
        return {}
    return {k: process_template(str(v), context) for k, v in headers.items()}


def evaluate_expression(expr: str, ctx: dict):
    """Evaluate a single template expression."""
    parts = _split_expression(expr)
    func_name = parts[0]
    args = parts[1:] if len(parts) > 1 else []

    # Random generators
    if func_name == "randomUUID":
        return str(uuid.uuid4())
    elif func_name == "randomInt":
        lo = int(args[0]) if args else 1
        hi = int(args[1]) if len(args) > 1 else 1000
        return random.randint(lo, hi)
    elif func_name == "randomFloat":
        lo = float(args[0]) if args else 0.0
        hi = float(args[1]) if len(args) > 1 else 100.0
        dec = int(args[2]) if len(args) > 2 else 2
        return round(random.uniform(lo, hi), dec)
    elif func_name == "randomString":
        length = int(args[0]) if args else 10
        return ''.join(random.choices(string.ascii_letters + string.digits, k=length))
    elif func_name == "randomBool":
        return "true" if random.choice([True, False]) else "false"

    # Image URL generators (take args, so not in registry)
    elif func_name == "randomImage":
        width = int(args[0]) if args else 200
        height = int(args[1]) if len(args) > 1 else 200
        seed = random.randint(1, 1000)
        return f"https://picsum.photos/seed/{seed}/{width}/{height}"
    elif func_name == "randomAvatar":
        name = args[0] if args else fake.first_name()
        return f"https://ui-avatars.com/api/?name={name}&background=random&size=128"
    elif func_name == "randomImageUrl":
        return f"https://picsum.photos/seed/{random.randint(1,1000)}/400/400"
    elif func_name == "randomPlaceholder":
        width = int(args[0]) if args else 300
        height = int(args[1]) if len(args) > 1 else 200
        return f"https://via.placeholder.com/{width}x{height}"

    # Time
    elif func_name == "now":
        return datetime.now(timezone.utc).isoformat()
    elif func_name == "timestamp":
        return int(time.time())

    # Request context
    elif func_name.startswith("request."):
        path = func_name[8:]
        return get_nested_value(ctx.get("request", {}), path) or ""

    # Faker
    elif func_name.startswith("faker."):
        method_name = func_name[6:]
        try:
            obj = fake
            for part in method_name.split("."):
                obj = getattr(obj, part)
            if callable(obj):
                return obj()
            return obj
        except (AttributeError, TypeError):
            return f"{{{{unknown: {func_name}}}}}"

    # List selection
    elif func_name == "oneOf":
        choices = [a.strip('"').strip("'") for a in args]
        return random.choice(choices) if choices else ""

    # Repeat
    elif func_name == "repeat":
        count = int(args[0]) if args else 1
        template = ' '.join(args[1:]).strip("'\"") if len(args) > 1 else ""
        return ','.join([process_template(template, ctx) for _ in range(count)])

    # Registry lookup
    if func_name in GENERATOR_REGISTRY:
        return GENERATOR_REGISTRY[func_name]()

    return f"{{{{{expr}}}}}"


def _split_expression(expr: str) -> list[str]:
    """Split expression respecting quoted strings."""
    parts = []
    current = ""
    in_quote = None
    for ch in expr:
        if ch in ('"', "'") and in_quote is None:
            in_quote = ch
        elif ch == in_quote:
            in_quote = None
        elif ch == ' ' and in_quote is None:
            if current:
                parts.append(current)
            current = ""
            continue
        current += ch
    if current:
        parts.append(current)
    return parts


def get_nested_value(data, dotpath: str):
    """Get value from nested dict using dot notation."""
    if data is None:
        return None
    keys = dotpath.split(".")
    current = data
    for key in keys:
        if isinstance(current, dict):
            current = current.get(key)
        elif isinstance(current, list) and key.isdigit():
            idx = int(key)
            current = current[idx] if idx < len(current) else None
        else:
            return None
    return current


# ---------------------------------------------------------------------------
# Discoverable generator catalog
# ---------------------------------------------------------------------------

def get_available_generators() -> dict:
    """Return a dict of categories -> list of generator info for the API."""
    result = {}

    # Built-in generators (hardcoded in evaluate_expression)
    result["Core"] = [
        {"template": "{{randomUUID}}", "description": "Random UUID v4"},
        {"template": "{{randomInt}}", "description": "Random integer (default 1-1000). Args: min max"},
        {"template": "{{randomInt 1 100}}", "description": "Random integer between 1 and 100"},
        {"template": "{{randomFloat}}", "description": "Random float (default 0-100, 2 decimals). Args: min max decimals"},
        {"template": "{{randomFloat 0 1 4}}", "description": "Random float between 0 and 1 with 4 decimals"},
        {"template": "{{randomString}}", "description": "Random alphanumeric string (default 10 chars). Args: length"},
        {"template": "{{randomString 20}}", "description": "Random alphanumeric string of 20 characters"},
        {"template": "{{randomBool}}", "description": "Random boolean (true/false)"},
        {"template": "{{now}}", "description": "Current UTC datetime in ISO 8601 format"},
        {"template": "{{timestamp}}", "description": "Current Unix timestamp (seconds)"},
    ]

    # Image generators
    result["Image"] = [
        {"template": "{{randomImage}}", "description": "Random image URL (default 200x200). Args: width height"},
        {"template": "{{randomImage 640 480}}", "description": "Random image URL at 640x480"},
        {"template": "{{randomAvatar}}", "description": "Random avatar URL. Args: name (optional)"},
        {"template": "{{randomAvatar John}}", "description": "Avatar URL for 'John'"},
        {"template": "{{randomImageUrl}}", "description": "Random image URL (400x400)"},
        {"template": "{{randomPlaceholder}}", "description": "Placeholder image URL (default 300x200). Args: width height"},
        {"template": "{{randomPlaceholder 800 600}}", "description": "Placeholder image at 800x600"},
    ]

    # Utility generators
    result["Utility"] = [
        {"template": "{{oneOf 'a' 'b' 'c'}}", "description": "Pick one value from a list"},
        {"template": "{{repeat 3 '{{randomInt}}'}}", "description": "Repeat a template N times (comma-separated)"},
        {"template": "{{request.body.name}}", "description": "Access incoming request data via dot notation"},
        {"template": "{{faker.sentence}}", "description": "Call any Faker method via faker.<method> syntax"},
    ]

    # Registry-based generators by category
    for category, names in _REGISTRY_CATEGORIES.items():
        entries = []
        for name in names:
            desc = _GENERATOR_DESCRIPTIONS.get(name, name)
            entries.append({"template": "{{" + name + "}}", "description": desc})
        result[category] = entries

    return result
