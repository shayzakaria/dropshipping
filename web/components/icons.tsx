import type { SVGProps } from "react";

/* מערכת אייקונים אחידה: קו 1.8, קצוות מעוגלים, נמשכת מעולם האריזה */

function Base({ children, ...props }: SVGProps<SVGSVGElement>) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.8}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      {...props}
    >
      {children}
    </svg>
  );
}

export function TagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M20.6 12.3l-8.3 8.3a2 2 0 0 1-2.8 0L3 14.1V5a2 2 0 0 1 2-2h9.1l6.5 6.5a2 2 0 0 1 0 2.8z" />
      <circle cx="7.6" cy="7.6" r="1.4" />
    </Base>
  );
}

export function MegaphoneIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 11l17-6v14L3 13v-2z" />
      <path d="M11.5 16.6a3.2 3.2 0 0 1-6.2-1.4" />
    </Base>
  );
}

export function BagIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M6.3 2.5L3.5 6v13.5a2 2 0 0 0 2 2h13a2 2 0 0 0 2-2V6l-2.8-3.5z" />
      <path d="M3.5 6h17" />
      <path d="M15.8 9.5a3.8 3.8 0 0 1-7.6 0" />
    </Base>
  );
}

export function StoreIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M4 10v9.5h16V10" />
      <path d="M2.8 6.2L4.5 3h15l1.7 3.2a2.3 2.3 0 0 1-4.1 2 2.3 2.3 0 0 1-4.05.05A2.3 2.3 0 0 1 9 8.2a2.3 2.3 0 0 1-4.1-.05z" />
      <path d="M9.5 19.5V14h5v5.5" />
    </Base>
  );
}

export function BoxIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M21 8.2v8.6a1.8 1.8 0 0 1-1 1.6l-7 3.5a1.8 1.8 0 0 1-1.9 0l-7-3.5a1.8 1.8 0 0 1-1-1.6V8.2a1.8 1.8 0 0 1 1-1.6l7-3.5a1.8 1.8 0 0 1 1.9 0l7 3.5a1.8 1.8 0 0 1 1 1.6z" />
      <path d="M3.4 7.3l8.6 4.2 8.6-4.2" />
      <path d="M12 11.5V21" />
    </Base>
  );
}

export function TrendIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <path d="M3 17l6-6 4 4 8-8" />
      <path d="M15.5 7H21v5.5" />
    </Base>
  );
}

export function ScissorsIcon(props: SVGProps<SVGSVGElement>) {
  return (
    <Base {...props}>
      <circle cx="6" cy="6.5" r="2.6" />
      <circle cx="6" cy="17.5" r="2.6" />
      <path d="M8.2 8.2L20 19M20 5L8.2 15.8" />
    </Base>
  );
}

export function ArrowIcon(props: SVGProps<SVGSVGElement>) {
  /* חץ "המשך" בעברית — מצביע שמאלה */
  return (
    <Base {...props}>
      <path d="M19 12H5" />
      <path d="M11 6l-6 6 6 6" />
    </Base>
  );
}
