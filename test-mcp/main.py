import asyncio
from fastmcp import FastMCP, Context

mcp = FastMCP("My MCP Server")

@mcp.tool
def greet(name: str) -> str:
    return f"Hello, {name}!"

@mcp.tool
def add(a: int, b: int) -> int:
    return a + b

@mcp.tool
def subtract(a: int, b: int) -> int:
    return a - b

@mcp.tool
async def progress_test(ctx: Context) -> str:
    """A simple progress test that sleeps for 2 seconds and reports progress"""

    # Report initial progress
    await ctx.report_progress(progress=0, total=100)

    # Sleep for 1 second
    await asyncio.sleep(1)

    # Report halfway progress
    await ctx.report_progress(progress=50, total=100)

    # Sleep for another second
    await asyncio.sleep(1)

    # Report completion
    await ctx.report_progress(progress=100, total=100)

    return "Progress test completed successfully!"

@mcp.tool
def git_diff() -> str:
    """Returns a demo git diff output as a string."""

    demo_diff = """diff --git a/README.md b/README.md
index abcd123..efgh456 100644
--- a/README.md
+++ b/README.md
@@ -1,6 +1,8 @@
 # My Project

-This is a simple project.
+This is an awesome project that does amazing things!
+
+## Features
+- Fast performance
+- Easy to use

 ## Installation
+
+Run the following command:
+```bash
+npm install my-project
+```

 ## Usage
+
+```javascript
+import { MyProject } from 'my-project';
+
+const project = new MyProject();
+project.start();
+```

diff --git a/src/components/Button.tsx b/src/components/Button.tsx
new file mode 100644
index 0000000..98a8b2c
--- /dev/null
+++ b/src/components/Button.tsx
@@ -0,0 +1,23 @@
+import React from 'react';
+
+interface ButtonProps {
+  children: React.ReactNode;
+  onClick?: () => void;
+  variant?: 'primary' | 'secondary' | 'danger';
+  disabled?: boolean;
+}
+
+export const Button: React.FC<ButtonProps> = ({
+  children,
+  onClick,
+  variant = 'primary',
+  disabled = false
+}) => {
+  const baseClasses = 'px-4 py-2 rounded-md font-medium transition-colors';
+  const variantClasses = {
+    primary: 'bg-blue-600 text-white hover:bg-blue-700',
+    secondary: 'bg-gray-200 text-gray-900 hover:bg-gray-300',
+    danger: 'bg-red-600 text-white hover:bg-red-700'
+  };
+
+  return (

diff --git a/src/utils/helpers.ts b/src/utils/helpers.ts
index 9876543..1234567 100644
--- a/src/utils/helpers.ts
+++ b/src/utils/helpers.ts
@@ -1,8 +1,25 @@
+/**
+ * Utility functions for common operations
+ */
+
 export function formatDate(date: Date): string {
-  return date.toLocaleDateString();
+  return date.toLocaleDateString('en-US', {
+    year: 'numeric',
+    month: 'long',
+    day: 'numeric'
+  });
 }

-export function capitalize(str: string): string {
-  return str.charAt(0).toUpperCase() + str.slice(1);
+export function capitalize(str: string): string {
+  if (!str) return '';
+  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
+}
+
+export function debounce<T extends (...args: any[]) => any>(
+  func: T,
+  wait: number
+): (...args: Parameters<T>) => void {
+  let timeout: NodeJS.Timeout;
+  return (...args: Parameters<T>) => {
+    clearTimeout(timeout);
+    timeout = setTimeout(() => func(...args), wait);
+  };
 }

diff --git a/package.json b/package.json
index 2f3a4c8..8b1e5d2 100644
--- a/package.json
+++ b/package.json
@@ -1,6 +1,6 @@
 {
   "name": "my-project",
-  "version": "1.0.0",
+  "version": "1.1.0",
   "description": "An awesome project",
   "main": "dist/index.js",
   "scripts": {
@@ -10,7 +10,8 @@
   },
   "dependencies": {
     "react": "^18.2.0",
-    "typescript": "^5.0.0"
+    "typescript": "^5.0.0",
+    "lodash": "^4.17.21"
   },
   "devDependencies": {
     "@types/react": "^18.2.0"

diff --git a/src/types/index.ts b/src/types/index.ts
deleted file mode 100644
index 1234567..0000000
--- a/src/types/index.ts
+++ /dev/null
@@ -1,5 +0,0 @@
-export interface User {
-  id: string;
-  name: string;
-  email: string;
-}"""

    return f"{demo_diff}\n\nTip: Use the filecompare tool to visualize these changes with a side-by-side comparison!"

if __name__ == "__main__":
    mcp.run()

# fastmcp run main.py:mcp --transport http --port 8000