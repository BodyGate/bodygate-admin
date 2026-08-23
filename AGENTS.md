<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

# UI conventions

Use the components in `components/bodygate-ui` (`BGCard`, `BGButton`, `BGPageHeader`, `BGTable`, ...) for new screens instead of ad-hoc `style={{...}}` objects or the generic `components/ui` (shadcn) primitives. Two parallel component systems and dozens of one-off inline styles already exist in this codebase — don't add a third pattern. If a needed primitive doesn't exist yet in `bodygate-ui`, add it there rather than reaching for inline styles.
