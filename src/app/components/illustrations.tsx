/** Inline SVG illustrations — Namibian hospitality theme
 *  Warm desert palette: sunset orange, sandy gold, terracotta, soft teal accents
 */

export function HeroIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 600 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      {/* Sky gradient */}
      <defs>
        <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#FDE8D0" />
          <stop offset="60%" stopColor="#F9C87C" />
          <stop offset="100%" stopColor="#E8855E" />
        </linearGradient>
        <linearGradient id="sand" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#E8A96A" />
          <stop offset="100%" stopColor="#D4885A" />
        </linearGradient>
      </defs>

      {/* Sky */}
      <rect width="600" height="350" fill="url(#sky)" rx="24" />

      {/* Sun */}
      <circle cx="460" cy="120" r="55" fill="#F59E0B" opacity="0.9" />
      <circle cx="460" cy="120" r="70" fill="#F59E0B" opacity="0.15" />

      {/* Distant dunes */}
      <path d="M0 280 Q100 220 200 260 Q300 200 400 250 Q500 210 600 240 L600 350 L0 350Z" fill="#D4885A" opacity="0.5" />
      <path d="M0 300 Q150 250 280 280 Q400 240 520 270 Q560 260 600 270 L600 350 L0 350Z" fill="#C67B4E" opacity="0.6" />

      {/* Lodge building */}
      <rect x="160" y="230" width="280" height="120" rx="6" fill="#8B6544" />
      <rect x="160" y="222" width="280" height="16" rx="3" fill="#A0764E" />

      {/* Roof */}
      <path d="M145 222 L300 170 L455 222Z" fill="#6B4C35" />

      {/* Windows */}
      <rect x="190" y="260" width="40" height="35" rx="3" fill="#FDE8D0" opacity="0.85" />
      <rect x="250" y="260" width="40" height="35" rx="3" fill="#FDE8D0" opacity="0.85" />
      <rect x="310" y="260" width="40" height="35" rx="3" fill="#FDE8D0" opacity="0.85" />
      <rect x="370" y="260" width="40" height="35" rx="3" fill="#FDE8D0" opacity="0.85" />

      {/* Window cross-bars */}
      <line x1="210" y1="260" x2="210" y2="295" stroke="#A0764E" strokeWidth="1.5" />
      <line x1="190" y1="277" x2="230" y2="277" stroke="#A0764E" strokeWidth="1.5" />
      <line x1="270" y1="260" x2="270" y2="295" stroke="#A0764E" strokeWidth="1.5" />
      <line x1="250" y1="277" x2="290" y2="277" stroke="#A0764E" strokeWidth="1.5" />
      <line x1="330" y1="260" x2="330" y2="295" stroke="#A0764E" strokeWidth="1.5" />
      <line x1="310" y1="277" x2="350" y2="277" stroke="#A0764E" strokeWidth="1.5" />
      <line x1="390" y1="260" x2="390" y2="295" stroke="#A0764E" strokeWidth="1.5" />
      <line x1="370" y1="277" x2="410" y2="277" stroke="#A0764E" strokeWidth="1.5" />

      {/* Door */}
      <rect x="280" y="305" width="40" height="45" rx="3" fill="#5C3D2A" />
      <circle cx="313" cy="328" r="2.5" fill="#D4A96A" />

      {/* Ground / garden */}
      <rect y="350" width="600" height="150" fill="url(#sand)" rx="0" />

      {/* Path to lodge */}
      <path d="M300 350 Q300 380 295 410 Q290 440 300 470 Q310 500 300 500" stroke="#C67B4E" strokeWidth="30" fill="none" opacity="0.4" />

      {/* Trees — Namibian camel thorn / acacia style */}
      {/* Left tree */}
      <rect x="95" y="270" width="8" height="80" fill="#6B4C35" />
      <ellipse cx="99" cy="255" rx="38" ry="25" fill="#5B8A4D" opacity="0.85" />
      <ellipse cx="82" cy="265" rx="22" ry="15" fill="#4A7A3D" opacity="0.7" />
      <ellipse cx="118" cy="262" rx="20" ry="14" fill="#4A7A3D" opacity="0.7" />

      {/* Right tree */}
      <rect x="495" y="280" width="7" height="70" fill="#6B4C35" />
      <ellipse cx="498" cy="268" rx="32" ry="22" fill="#5B8A4D" opacity="0.85" />
      <ellipse cx="482" cy="276" rx="18" ry="12" fill="#4A7A3D" opacity="0.7" />

      {/* Small bush details */}
      <ellipse cx="540" cy="360" rx="18" ry="10" fill="#5B8A4D" opacity="0.5" />
      <ellipse cx="60" cy="365" rx="22" ry="11" fill="#5B8A4D" opacity="0.5" />
      <ellipse cx="450" cy="372" rx="14" ry="8" fill="#5B8A4D" opacity="0.4" />

      {/* Birds */}
      <path d="M350 100 Q355 93 360 100" stroke="#6B4C35" strokeWidth="1.5" fill="none" />
      <path d="M380 85 Q385 78 390 85" stroke="#6B4C35" strokeWidth="1.5" fill="none" />
      <path d="M340 75 Q345 68 350 75" stroke="#6B4C35" strokeWidth="1.5" fill="none" />
    </svg>
  );
}

export function LoginIllustration({ className = "" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 400 500"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
      aria-hidden="true"
    >
      <defs>
        <linearGradient id="loginSky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#1E3A5F" />
          <stop offset="50%" stopColor="#E8855E" />
          <stop offset="100%" stopColor="#F9C87C" />
        </linearGradient>
      </defs>

      {/* Evening sky */}
      <rect width="400" height="500" fill="url(#loginSky)" />

      {/* Stars */}
      <circle cx="50" cy="40" r="1.5" fill="white" opacity="0.7" />
      <circle cx="120" cy="25" r="1" fill="white" opacity="0.5" />
      <circle cx="200" cy="55" r="1.5" fill="white" opacity="0.6" />
      <circle cx="320" cy="35" r="1" fill="white" opacity="0.5" />
      <circle cx="360" cy="70" r="1.5" fill="white" opacity="0.7" />
      <circle cx="80" cy="90" r="1" fill="white" opacity="0.4" />
      <circle cx="270" cy="15" r="1" fill="white" opacity="0.6" />

      {/* Moon */}
      <circle cx="320" cy="100" r="30" fill="#FDE8D0" opacity="0.9" />
      <circle cx="330" cy="92" r="28" fill="url(#loginSky)" />

      {/* Dune layers */}
      <path d="M0 320 Q100 280 200 310 Q300 260 400 290 L400 500 L0 500Z" fill="#C67B4E" opacity="0.6" />
      <path d="M0 360 Q80 330 180 355 Q280 320 400 340 L400 500 L0 500Z" fill="#D4885A" opacity="0.7" />
      <path d="M0 400 Q120 370 220 390 Q320 365 400 380 L400 500 L0 500Z" fill="#E8A96A" opacity="0.8" />

      {/* Welcoming lodge with warm light */}
      <rect x="100" y="340" width="200" height="80" rx="4" fill="#6B4C35" />
      <path d="M85 340 L200 295 L315 340Z" fill="#5C3D2A" />

      {/* Glowing windows */}
      <rect x="125" y="360" width="30" height="25" rx="2" fill="#F9C87C" opacity="0.95" />
      <rect x="185" y="360" width="30" height="25" rx="2" fill="#F9C87C" opacity="0.95" />
      <rect x="245" y="360" width="30" height="25" rx="2" fill="#F9C87C" opacity="0.95" />

      {/* Door with warm glow */}
      <rect x="181" y="393" width="38" height="27" rx="2" fill="#F59E0B" opacity="0.8" />
      <rect x="185" y="395" width="30" height="25" rx="2" fill="#5C3D2A" />
      <rect x="185" y="395" width="30" height="25" rx="2" fill="#F59E0B" opacity="0.3" />

      {/* Light spill from door */}
      <path d="M190 420 L170 500 L230 500 L210 420Z" fill="#F59E0B" opacity="0.08" />

      {/* Acacia silhouettes */}
      <rect x="50" y="365" width="5" height="55" fill="#3D2A1A" />
      <ellipse cx="52" cy="355" rx="28" ry="16" fill="#3D2A1A" opacity="0.9" />

      <rect x="340" y="370" width="4" height="50" fill="#3D2A1A" />
      <ellipse cx="342" cy="362" rx="24" ry="14" fill="#3D2A1A" opacity="0.9" />

      {/* Welcome text area glow */}
      <ellipse cx="200" cy="250" rx="120" ry="40" fill="#FDE8D0" opacity="0.06" />
    </svg>
  );
}

/** Small icons for dashboard KPI cards */
export function TaskIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M9 11l3 3L22 4" />
      <path d="M21 12v7a2 2 0 01-2 2H5a2 2 0 01-2-2V5a2 2 0 012-2h11" />
    </svg>
  );
}

export function InspectionIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <circle cx="11" cy="11" r="8" />
      <path d="M21 21l-4.35-4.35" />
    </svg>
  );
}

export function IssueIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={className}>
      <path d="M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z" />
      <line x1="12" y1="9" x2="12" y2="13" />
      <line x1="12" y1="17" x2="12.01" y2="17" />
    </svg>
  );
}

export function StarIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="currentColor" className={className}>
      <path d="M12 2l3.09 6.26L22 9.27l-5 4.87 1.18 6.88L12 17.77l-6.18 3.25L7 14.14 2 9.27l6.91-1.01L12 2z" />
    </svg>
  );
}

/** Nav icons for dashboard sidebar/nav links */
export function NavTasksIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M6 2a2 2 0 00-2 2v12a2 2 0 002 2h8a2 2 0 002-2V7.414A2 2 0 0015.414 6L12 2.586A2 2 0 0010.586 2H6zm5 6a1 1 0 10-2 0v2H7a1 1 0 100 2h2v2a1 1 0 102 0v-2h2a1 1 0 100-2h-2V8z" clipRule="evenodd" />
    </svg>
  );
}

export function NavTemplatesIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M3 4a1 1 0 011-1h12a1 1 0 011 1v2a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm0 6a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H4a1 1 0 01-1-1v-6zm10 0a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
    </svg>
  );
}

export function NavIssuesIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
    </svg>
  );
}

export function NavFeedbackIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M18 10c0 3.866-3.582 7-8 7a8.841 8.841 0 01-4.083-.98L2 17l1.338-3.123C2.493 12.767 2 11.434 2 10c0-3.866 3.582-7 8-7s8 3.134 8 7zM7 9H5v2h2V9zm8 0h-2v2h2V9zm-4 0H9v2h2V9z" clipRule="evenodd" />
    </svg>
  );
}

export function NavReportsIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M2 11a1 1 0 011-1h2a1 1 0 011 1v5a1 1 0 01-1 1H3a1 1 0 01-1-1v-5zm6-4a1 1 0 011-1h2a1 1 0 011 1v9a1 1 0 01-1 1H9a1 1 0 01-1-1V7zm6-3a1 1 0 011-1h2a1 1 0 011 1v12a1 1 0 01-1 1h-2a1 1 0 01-1-1V4z" />
    </svg>
  );
}

export function NavStaffIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path d="M9 6a3 3 0 11-6 0 3 3 0 016 0zm8 0a3 3 0 11-6 0 3 3 0 016 0zm-4.07 11c.046-.327.07-.66.07-1a6.97 6.97 0 00-1.5-4.33A5 5 0 0119 16v1h-6.07zM6 11a5 5 0 015 5v1H1v-1a5 5 0 015-5z" />
    </svg>
  );
}

export function NavQRIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M3 4a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1V4zm2 2V5h1v1H5zm-2 7a1 1 0 011-1h3a1 1 0 011 1v3a1 1 0 01-1 1H4a1 1 0 01-1-1v-3zm2 2v-1h1v1H5zm7-11a1 1 0 00-1 1v3a1 1 0 001 1h3a1 1 0 001-1V4a1 1 0 00-1-1h-3zm1 2v1h1V5h-1z" clipRule="evenodd" />
      <path d="M11 4a1 1 0 10-2 0v1a1 1 0 002 0V4zm-1 7a1 1 0 011 1v1h1a1 1 0 110 2h-2a1 1 0 01-1-1v-2a1 1 0 011-1zm4 0a1 1 0 100 2 1 1 0 100-2z" />
    </svg>
  );
}

export function NavAuditIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 20 20" fill="currentColor" className={className}>
      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm1-12a1 1 0 10-2 0v4a1 1 0 00.293.707l2.828 2.829a1 1 0 101.415-1.415L11 9.586V6z" clipRule="evenodd" />
    </svg>
  );
}
