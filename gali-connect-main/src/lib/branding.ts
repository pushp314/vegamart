/**
 * Developer branding & DevTools easter egg.
 * Big-tech style console attribution for Pushp Raj Sharma (pushpa.builds).
 */

let isBrandingLogged = false;

export function initDeveloperCredits(): void {
  if (isBrandingLogged || typeof window === "undefined") {
    return;
  }
  isBrandingLogged = true;

  const titleStyle = [
    "background: linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)",
    "color: #ffffff",
    "font-size: 14px",
    "font-weight: bold",
    "padding: 6px 12px",
    "border-radius: 6px 0 0 6px",
    "text-shadow: 0 1px 2px rgba(0,0,0,0.3)",
  ].join(";");

  const badgeStyle = [
    "background: #1e293b",
    "color: #38bdf8",
    "font-size: 13px",
    "font-weight: 600",
    "padding: 6px 12px",
    "border-radius: 0 6px 6px 0",
    "border: 1px solid #334155",
  ].join(";");

  const subtitleStyle = [
    "color: #94a3b8",
    "font-size: 11px",
    "font-style: italic",
    "padding: 4px 0",
  ].join(";");

  const sectionHeaderStyle = [
    "color: #10b981",
    "font-size: 12px",
    "font-weight: bold",
    "margin-top: 4px",
  ].join(";");

  const bodyStyle = [
    "color: #cbd5e1",
    "font-size: 11px",
    "line-height: 1.6",
  ].join(";");

  const linkStyle = [
    "color: #38bdf8",
    "font-size: 11px",
    "text-decoration: underline",
    "font-weight: 500",
  ].join(";");

  console.log(
    "%c⚡ PUSHPA.BUILDS%cEngineered by Pushp Raj Sharma",
    titleStyle,
    badgeStyle
  );

  console.log(
    "%cBuilding practical software, cybersecurity tools, and scalable digital products.",
    subtitleStyle
  );

  console.log(
    `%c👨‍💻 Developer & Architect:%c Pushp Raj Sharma\n` +
      `%c🌐 Portfolio:%c https://pushp-portfolio.vercel.app/\n` +
      `%c🐙 GitHub:%c https://github.com/pushp314\n` +
      `%c💼 LinkedIn:%c https://www.linkedin.com/in/pushp-raj-sharma/\n` +
      `%c🐦 X / Twitter:%c https://x.com/pushpa_builds\n` +
      `%c📬 Inquiries & Hiring:%c pusprajsharma314@gmail.com`,
    sectionHeaderStyle,
    bodyStyle,
    sectionHeaderStyle,
    linkStyle,
    sectionHeaderStyle,
    linkStyle,
    sectionHeaderStyle,
    linkStyle,
    sectionHeaderStyle,
    linkStyle,
    sectionHeaderStyle,
    linkStyle
  );
}
