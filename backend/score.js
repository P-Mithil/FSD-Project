// Live Jobs weights; resume/JD analysis uses src/matching.js.
const JOB_WEIGHTS = {
  skills: 40,
  role: 25,
  experience: 20,
  location: 10,
  education: 5,
};

const skillPatterns = {
  React: "react(?:\\.js|js)?(?!\\s+native)",
  JavaScript: "javascript|js",
  TypeScript: "typescript|ts",
  Python: "python",
  Java: "java",
  HTML: "html5?",
  CSS: "css3?",
  SQL: "sql",
  "Node.js": "node(?:\\.js|js)?",
  Express: "express(?:\\.js|js)?",
  Angular: "angular(?:js)?",
  Vue: "vue(?:\\.js|js)?",
  "Next.js": "next(?:\\.js|js)",
  Django: "django",
  Flask: "flask",
  Spring: "spring(?: boot)?",
  PostgreSQL: "postgres(?:ql)?",
  MySQL: "mysql",
  MongoDB: "mongodb|mongo",
  Firebase: "firebase",
  Redis: "redis",
  Git: "git",
  GitHub: "github",
  Docker: "docker",
  Kubernetes: "kubernetes|k8s",
  AWS: "aws|amazon web services",
  Azure: "azure",
  GCP: "gcp|google cloud",
  "C++": "c\\+\\+",
  "C#": "c#",
  ".NET": "\\.net|dotnet",
  Go: "golang|go",
  Rust: "rust",
  PHP: "php",
  Laravel: "laravel",
  Ruby: "ruby",
  Rails: "rails",
  Swift: "swift",
  Kotlin: "kotlin",
  Flutter: "flutter",
  "React Native": "react native",
  Android: "android",
  iOS: "ios",
  Selenium: "selenium",
  Cypress: "cypress",
  Playwright: "playwright",
  Jest: "jest",
  GraphQL: "graphql",
  "REST APIs": "rest(?:ful)?(?: apis?)?",
  Linux: "linux",
  Pandas: "pandas",
  NumPy: "numpy",
  TensorFlow: "tensorflow",
  PyTorch: "pytorch",
  "Machine Learning": "machine learning",
  "Power BI": "power bi|powerbi",
  Tableau: "tableau",
};
const skillRegex = (pattern) =>
  new RegExp(`(^|[^a-z0-9.])(${pattern})(?=$|[^a-z0-9])`, "i");
export function extractSkills(text) {
  return Object.entries(skillPatterns)
    .filter(([, pattern]) => skillRegex(pattern).test(text))
    .map(([name]) => name);
}
const ROLE_RULES = [
  {
    name: "Frontend Developer",
    title: /front[ -]?end|web developer|ui engineer/i,
    skills: ["React", "Angular", "Vue", "HTML", "CSS"],
  },
  {
    name: "Backend Developer",
    title: /back[ -]?end|api developer|server[ -]?side/i,
    skills: ["Node.js", "Express", "Django", "Flask", "Spring"],
  },
  { name: "Full Stack Developer", title: /full[ -]?stack/i, skills: [] },
  {
    name: "Data Engineer",
    title:
      /data engineer|data scientist|machine learning|\bml engineer|\bai engineer/i,
    skills: ["Pandas", "NumPy", "TensorFlow", "PyTorch", "Machine Learning"],
  },
  {
    name: "Mobile Developer",
    title: /mobile|android|ios|flutter|react native/i,
    skills: ["React Native", "Flutter", "Android", "iOS", "Swift", "Kotlin"],
  },
  {
    name: "DevOps Engineer",
    title: /devops|site reliability|cloud engineer|platform engineer/i,
    skills: ["Kubernetes", "Docker", "AWS", "Azure", "GCP"],
  },
  {
    name: "QA Engineer",
    title:
      /qa engineer|quality assurance|test engineer|sdet|automation engineer/i,
    skills: ["Selenium", "Cypress", "Playwright", "Jest"],
  },
];
export function getRoles(title) {
  const roles = ROLE_RULES.filter((rule) => rule.title.test(title)).map(
    (rule) => rule.name,
  );
  if (
    !roles.length &&
    /software|developer|programmer|application engineer/i.test(title)
  )
    roles.push("Software Engineer");
  return roles;
}
export function normalizeCity(value = "") {
  return value
    .toLowerCase()
    .trim()
    .replace(/\bbangalore\b/g, "bengaluru")
    .replace(
      /\b(?:new delhi|delhi ncr|ncr|noida|gurugram|gurgaon)\b/g,
      "delhi",
    );
}
function section(text, heading) {
  const lines = text.split(/\n/);
  const selected = [];
  let active = false;
  for (const line of lines) {
    if (heading.test(line.trim())) {
      active = true;
      continue;
    }
    if (
      /^(?:education|projects?|skills|technical skills|work experience|professional experience|experience|certifications?|summary|profile)\s*:?$/i.test(
        line.trim(),
      )
    )
      active = false;
    if (active && line.trim()) selected.push(line.trim());
  }
  return selected.join("\n");
}
function education(text) {
  const degrees = [];
  if (/\b(?:ph\.?d|doctorate)\b/i.test(text)) degrees.push("doctorate");
  if (/\b(?:master'?s|master of|m\.?tech|mca|m\.?sc|m\.?s\.)\b/i.test(text))
    degrees.push("masters");
  if (
    /\b(?:bachelor'?s?|b\.?tech|b\.e\.?|bca|b\.?sc|b\.?s\.)\b/i.test(text) ||
    /\bBE\b/.test(text)
  )
    degrees.push("bachelors");
  if (/\bdiploma\b/i.test(text)) degrees.push("diploma");
  return [...new Set(degrees)];
}
export function getProfile(text) {
  // Aspirations and negated claims do not demonstrate a qualification.
  const evidence = text
    .split(/\n|[.!?]\s/)
    .filter(
      (line) =>
        !/\b(?:want to learn|interested in learning|no (?:knowledge|experience)|do not know|not familiar|currently learning)\b/i.test(
          line,
        ),
    )
    .join("\n");
  const skills = extractSkills(evidence);
  const projects = section(text, /^projects?\s*:?$/i);
  const work = section(
    text,
    /^(?:work experience|professional experience|experience)\s*:?$/i,
  );
  const stated = evidence.match(
    /\b(\d+(?:\.\d+)?)\+?\s*years?\s+(?:of\s+)?(?:(?:professional|work|industry|commercial|software development)\s+){0,2}experience\b/i,
  );
  let experienceYears = stated
    ? Number(stated[1])
    : /\b(?:fresher|no (?:professional |work )?experience)\b/i.test(text)
      ? 0
      : null;
  // Only dates inside the work section count. Overlapping employments are merged.
  const intervals = [
    ...work.matchAll(/\b(20\d{2})\s*[-–—]\s*(20\d{2}|present|current)\b/gi),
  ]
    .map((m) => [
      Number(m[1]),
      /present|current/i.test(m[2])
        ? new Date().getUTCFullYear()
        : Number(m[2]),
    ])
    .filter(([a, b]) => b >= a && b <= new Date().getUTCFullYear())
    .sort((a, b) => a[0] - b[0]);
  if (experienceYears === null && intervals.length) {
    let total = 0;
    let end = 0;
    for (const [a, b] of intervals) {
      total += Math.max(0, b - Math.max(a, end));
      end = Math.max(end, b);
    }
    experienceYears = total;
  }
  let roles = ROLE_RULES.filter(
    (rule) =>
      rule.title.test(evidence.slice(0, 500)) ||
      rule.skills.filter((s) => skills.includes(s)).length >= 2,
  ).map((rule) => rule.name);
  if (
    roles.includes("Frontend Developer") &&
    roles.includes("Backend Developer")
  )
    roles.unshift("Full Stack Developer");
  if (!roles.length && skills.length) roles = ["Software Engineer"];
  const preferred = text.match(
    /(?:preferred (?:job )?location|open to work in|seeking (?:roles?|jobs?) in)\s*:?\s*([^\n;.]+)/i,
  );
  return {
    skills,
    roles: [...new Set(roles)],
    experienceYears,
    education: education(evidence),
    projects: projects.slice(0, 1800),
    experienceEvidence: work.slice(0, 1800),
    preferredLocation: preferred ? normalizeCity(preferred[1]) : null,
  };
}

function requirementLines(description) {
  let preferred = false;
  let required = false;
  const lines = [];
  for (const raw of description.split(/\n|[.;]\s+/)) {
    const line = raw.trim();
    if (!line) continue;
    if (/^(?:nice to have|preferred|bonus|desirable|optional)/i.test(line)) {
      preferred = true;
      required = false;
    } else if (
      /^(?:qualifications?|requirements?|required|what you(?:'|’)ll (?:need|bring)|what you bring|about you|skills|must have|who you are)/i.test(
        line,
      )
    ) {
      required = true;
      preferred = false;
    } else if (
      /^(?:about (?:us|the company)|benefits|perks|equal opportunit|what we offer)/i.test(
        line,
      )
    ) {
      required = false;
      preferred = false;
    }
    if (
      !preferred &&
      (required ||
        /\b(?:must|required|proficien|hands.on|experience (?:in|with)|knowledge of|familiarity with)\b/i.test(
          line,
        )) &&
      !/\b(?:preferred|nice to have|bonus|optional)\b/i.test(line)
    )
      lines.push(line);
  }
  return lines;
}
export function getRequirements(job) {
  const lines = requirementLines(job.description || "");
  const groups = [];
  for (const line of lines) {
    const skills = extractSkills(line);
    // Alternatives earn one credit only; AND lists remain separate requirements.
    if (
      /\b(?:or|and\/or)\b/i.test(line) &&
      skills.length === 2 &&
      !/\band\b(?!\/or)/i.test(line)
    )
      groups.push(skills);
    else skills.forEach((skill) => groups.push([skill]));
  }
  const unique = [
    ...new Map(
      groups.map((group) => [[...group].sort().join("|"), group]),
    ).values(),
  ];
  const experienceText = (job.title + "\n" + lines.join("\n")).replace(
    /(\d+)\s*(?:years?|yrs?)\s*[-–—]\s*(\d+)\s*(?:years?|yrs?)/gi,
    "$1-$2 years",
  );
  const experienceMatches = [
    ...experienceText.matchAll(
      /\b(\d+(?:\.\d+)?)\s*(?:(?:[-–—]|to)\s*\d+(?:\.\d+)?)?\+?\s*(?:years?|yrs?)\b/gi,
    ),
  ];
  const minimumExperience = experienceMatches.length
    ? Math.max(...experienceMatches.map((m) => Number(m[1])))
    : /\b(?:freshers? welcome|no experience required|fresh graduates?)\b/i.test(
          job.description,
        )
      ? 0
      : null;
  const degreeLines = lines.filter((line) =>
    /\b(?:degree|bachelor|master|b\.?tech|m\.?tech|bca|mca|ph\.?d)\b/i.test(
      line,
    ),
  );
  const degrees = education(degreeLines.join("\n"));
  return {
    skillGroups: unique,
    minimumExperience,
    degrees,
    equivalentEducationAllowed: degreeLines.some((line) =>
      /or equivalent (?:practical |work )?experience/i.test(line),
    ),
  };
}

export function getScore(job, profile, location = "", options = {}) {
  const requirements = getRequirements(job);
  const matched = requirements.skillGroups.filter((group) =>
    group.some((skill) => profile.skills.includes(skill)),
  );
  const missing = requirements.skillGroups.filter(
    (group) => !group.some((skill) => profile.skills.includes(skill)),
  );
  const jobRoles = getRoles(job.title);
  const exactRole = jobRoles.some((role) => profile.roles.includes(role));
  const genericRole =
    jobRoles.includes("Software Engineer") && profile.roles.length > 0;
  const relatedRole =
    profile.roles.includes("Full Stack Developer") &&
    jobRoles.some((role) =>
      ["Frontend Developer", "Backend Developer"].includes(role),
    );
  const chosenLocation = normalizeCity(
    location || profile.preferredLocation || "",
  );
  const degreeRank = { diploma: 1, bachelors: 2, masters: 3, doctorate: 4 };
  const educationMatch = requirements.degrees.some((required) =>
    profile.education.some(
      (actual) => degreeRank[actual] >= degreeRank[required],
    ),
  );
  const locationMatch =
    chosenLocation === "remote"
      ? job.remote
      : job.remote || normalizeCity(job.location).includes(chosenLocation);
  const ineligible =
    requirements.minimumExperience !== null &&
    profile.experienceYears !== null &&
    profile.experienceYears < requirements.minimumExperience;
  const degreeIneligible =
    requirements.degrees.length > 0 &&
    profile.education.length > 0 &&
    !educationMatch &&
    !requirements.equivalentEducationAllowed;
  const factors = [
    {
      id: "skills",
      label: "Required technical skills",
      applicable: requirements.skillGroups.length > 0,
      credit: matched.length / (requirements.skillGroups.length || 1),
      evidence: `${matched.length}/${requirements.skillGroups.length} required skill groups demonstrated`,
    },
    {
      id: "role",
      label: "Job role relevance",
      applicable: jobRoles.length > 0,
      credit: exactRole || genericRole || relatedRole ? 1 : 0,
      evidence: jobRoles.join(", ") || "No recognizable role",
    },
    {
      id: "experience",
      label: "Experience eligibility",
      applicable: requirements.minimumExperience !== null,
      credit:
        profile.experienceYears !== null &&
        profile.experienceYears >= requirements.minimumExperience
          ? 1
          : 0,
      evidence: `Requires ${requirements.minimumExperience ?? "unspecified"} years; resume ${profile.experienceYears ?? "not established"}`,
    },
    {
      id: "location",
      label: "Preferred location",
      applicable: Boolean(chosenLocation && job.location),
      credit: locationMatch ? 1 : 0,
      evidence: chosenLocation
        ? `Preference: ${chosenLocation}; listing: ${job.location}`
        : "No preference selected",
    },
    {
      id: "education",
      label: "Education eligibility",
      applicable: requirements.degrees.length > 0,
      credit: educationMatch ? 1 : 0,
      evidence: requirements.degrees.length
        ? `Requires ${requirements.degrees.join(" or ")}; resume ${profile.education.join(", ") || "not established"}`
        : "No degree specified",
    },
  ];
  const totalWeight = factors
    .filter((row) => row.applicable)
    .reduce((sum, row) => sum + JOB_WEIGHTS[row.id], 0);
  const breakdown = factors.map((row) => ({
    ...row,
    weight: JOB_WEIGHTS[row.id],
    effectiveWeight: row.applicable && totalWeight > 0
      ? (JOB_WEIGHTS[row.id] / totalWeight) * 100
      : 0,
    contribution: row.applicable && totalWeight > 0
      ? ((row.credit * JOB_WEIGHTS[row.id]) / totalWeight) * 100
      : 0,
  }));
  // A title or a truncated company introduction alone cannot support a percentage.
  const scorable =
    totalWeight > 0 &&
    (job.fullDescription || options.allowPartial === true) &&
    job.description.length >= 180 &&
    requirements.skillGroups.length > 0 &&
    profile.skills.length > 0;
  const matchScore = scorable
    ? Math.round(
        breakdown.reduce((sum, row) => sum + row.contribution, 0) + 1e-10,
      )
    : null;
  return {
    matchScore,
    partial: scorable && !job.fullDescription,
    ineligible: ineligible || degreeIneligible,
    breakdown,
    requiredSkills: requirements.skillGroups.map((group) => group.join(" or ")),
    matchedSkills: matched.map((group) =>
      group.filter((skill) => profile.skills.includes(skill)).join(" or "),
    ),
    missingSkills: missing.map((group) => group.join(" or ")),
    explanation: !scorable
      ? "The available description or resume has insufficient identifiable skill evidence."
      : `${!job.fullDescription ? "Estimated from an incomplete source description. " : ""}${matched.length} of ${requirements.skillGroups.length} required skill groups demonstrated. ${profile.experienceYears === null && requirements.minimumExperience !== null ? "Work experience needs confirmation." : "Review source eligibility before applying."}`,
  };
}
export function sortJobs(results) {
  return [...results].sort(
    (a, b) =>
      (b.analysis.matchScore ?? -1) - (a.analysis.matchScore ?? -1) ||
      (Date.parse(b.job.postedAt) || 0) - (Date.parse(a.job.postedAt) || 0) ||
      a.job.id.localeCompare(b.job.id),
  );
}
