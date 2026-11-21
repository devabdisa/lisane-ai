import { themeInitScript } from "@/lib/theme";

// Inline blocking script: must run before the first paint. Do not move behind
// next/script or a client component, or the wrong theme will flash.
function ThemeScript() {
  return (
    <script
      // The script is a static string from our own module; it never interpolates user input.
      dangerouslySetInnerHTML={{ __html: themeInitScript }}
    />
  );
}

export { ThemeScript };
