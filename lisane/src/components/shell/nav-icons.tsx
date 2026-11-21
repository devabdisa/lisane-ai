import type { SVGProps } from "react";

// Paths come from the Figma bottom-navigation icons (24px frame, 1.6px stroke);
// the progress icon is our own, drawn on the same grid.

function NavIcon({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      {...props}
    >
      {children}
    </svg>
  );
}

export function LearnIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <NavIcon {...props}>
      <g transform="translate(2.2 2.2)">
        <path d="M0.8 7.8L9.8 0.8L18.8 7.8V17.8H0.8V7.8Z" />
        <path d="M6.8 17.8V10.8H12.8V17.8" />
      </g>
    </NavIcon>
  );
}

export function SpeakIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <NavIcon {...props}>
      <g transform="translate(4.2 2.2)">
        <path d="M7.8 0.8C9.45685 0.8 10.8 2.14315 10.8 3.8V9.8C10.8 11.4569 9.45685 12.8 7.8 12.8C6.14315 12.8 4.8 11.4569 4.8 9.8V3.8C4.8 2.14315 6.14315 0.8 7.8 0.8Z" />
        <path d="M0.8 7.8V9.8C0.8 11.6565 1.5375 13.437 2.85025 14.7497C4.16301 16.0625 5.94348 16.8 7.8 16.8M7.8 16.8C9.65652 16.8 11.437 16.0625 12.7497 14.7497C14.0625 13.437 14.8 11.6565 14.8 9.8V7.8M7.8 16.8V19.8M7.8 19.8H3.8M7.8 19.8H11.8" />
      </g>
    </NavIcon>
  );
}

export function PracticeIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <NavIcon {...props}>
      <g transform="translate(3.2 2.2)">
        <path d="M3.8 0.8H13.8M2.8 2.8H14.8M4.8 10.8L7.8 13.8L12.8 7.8M0.8 4.8H16.8V18.8H0.8V4.8Z" />
      </g>
    </NavIcon>
  );
}

export function ProgressIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <NavIcon {...props}>
      <path d="M4 12H8V21H4V12Z" />
      <path d="M10 3H14V21H10V3Z" />
      <path d="M16 8H20V21H16V8Z" />
    </NavIcon>
  );
}

export function ProfileIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <NavIcon {...props}>
      <g transform="translate(3.2 2.2)">
        <path d="M12.8 4.8C12.8 7.00914 11.0091 8.8 8.8 8.8C6.59086 8.8 4.8 7.00914 4.8 4.8C4.8 2.59086 6.59086 0.8 8.8 0.8C11.0091 0.8 12.8 2.59086 12.8 4.8Z" />
        <path d="M0.8 18.8V16.8C0.8 14.6783 1.64285 12.6434 3.14315 11.1431C4.64344 9.64285 6.67827 8.8 8.8 8.8C10.9217 8.8 12.9566 9.64285 14.4569 11.1431C15.9571 12.6434 16.8 14.6783 16.8 16.8V18.8" />
      </g>
    </NavIcon>
  );
}
