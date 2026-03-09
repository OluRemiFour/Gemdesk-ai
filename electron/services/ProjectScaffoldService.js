import fs from 'fs';
import path from 'path';
import os from 'os';

/**
 * Project Scaffolding Service
 * Detects developer project requests, creates project structure, and generates README
 */
export class ProjectScaffoldService {
    constructor(defaultProjectsDir = path.join(os.homedir(), 'Documents', 'GemDeskProjects')) {
        this.defaultProjectsDir = defaultProjectsDir;
        this.templates = this.initializeTemplates();
    }

    /**
     * Detect project type from user request
     */
    detectProjectType(description) {
        if (!description) return 'generic';
        const desc = description.toLowerCase();

        if (desc.match(/\b(react|next\.?js|nextjs)\b/i)) {
            return 'nextjs';
        }
        if (desc.match(/\b(website|webpage|landing page|html|css)\b/i)) {
            return 'website';
        }
        if (desc.match(/\b(api|rest|express|backend|server)\b/i)) {
            return 'api';
        }
        if (desc.match(/\b(python|flask|django|fastapi)\b/i)) {
            return 'python';
        }
        if (desc.match(/\b(vue|vuejs)\b/i)) {
            return 'vue';
        }
        if (desc.match(/\b(electron|desktop)\b/i)) {
            return 'electron';
        }
        if (desc.match(/\b(mobile|react native|flutter)\b/i)) {
            return 'mobile';
        }

        return 'generic';
    }

    /**
     * Create project folder and structure
     */
    createProject(projectName, projectType, description = '', parentDir = null) {
        try {
            // Sanitize project name for folder
            const folderName = (projectName || 'unnamed-project')
                .toLowerCase()
                .replace(/[^a-z0-9-_]/g, '-')
                .replace(/-+/g, '-');

            const baseDir = parentDir || this.defaultProjectsDir;
            const projectPath = path.join(baseDir, folderName);

            // Create main folder
            if (!fs.existsSync(baseDir)) {
                fs.mkdirSync(baseDir, { recursive: true });
            }

            if (fs.existsSync(projectPath)) {
                return {
                    success: false,
                    error: `Project folder already exists: ${projectPath}`
                };
            }

            fs.mkdirSync(projectPath, { recursive: true });

            // Create subfolders based on type
            const structure = this.getProjectStructure(projectType);
            structure.folders.forEach(folder => {
                fs.mkdirSync(path.join(projectPath, folder), { recursive: true });
            });

            // Generate README.md
            const readme = this.generateReadme(projectName, projectType, description);
            fs.writeFileSync(path.join(projectPath, 'README.md'), readme);

            // Create placeholder files based on type
            const files = this.getStarterFiles(projectType);
            Object.entries(files).forEach(([filename, content]) => {
                const filePath = path.join(projectPath, filename);
                const fileDir = path.dirname(filePath);
                if (!fs.existsSync(fileDir)) {
                    fs.mkdirSync(fileDir, { recursive: true });
                }
                fs.writeFileSync(filePath, content);
            });

            return {
                success: true,
                projectPath,
                message: `Project created successfully at: ${projectPath}`,
                projectType,
                folderName
            };
        } catch (error) {
            return {
                success: false,
                error: error.message
            };
        }
    }

    /**
     * Get project folder structure
     */
    getProjectStructure(projectType) {
        const structures = {
            website: {
                folders: ['css', 'js', 'images', 'assets']
            },
            nextjs: {
                folders: ['src/app', 'src/components', 'public', 'src/styles']
            },
            api: {
                folders: ['src/routes', 'src/controllers', 'src/models', 'src/middleware']
            },
            python: {
                folders: ['src', 'tests', 'docs']
            },
            vue: {
                folders: ['src/components', 'src/views', 'src/assets', 'public']
            },
            electron: {
                folders: ['src', 'assets', 'build']
            },
            mobile: {
                folders: ['src/screens', 'src/components', 'src/assets', 'src/navigation']
            },
            generic: {
                folders: ['src', 'docs', 'tests']
            }
        };

        return structures[projectType] || structures.generic;
    }

    /**
     * Get starter files for project type
     */
    getStarterFiles(projectType) {
        const files = {
            website: {
                'index.html': `<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>My Project</title>
    <link rel="stylesheet" href="css/style.css">
</head>
<body>
    <h1>Welcome to Your Project</h1>
    <script src="js/script.js"></script>
</body>
</html>`,
                'css/style.css': `/* Main Styles */
* {
    margin: 0;
    padding: 0;
    box-sizing: border-box;
}

body {
    font-family: Arial, sans-serif;
    line-height: 1.6;
}`,
                'js/script.js': `// Main JavaScript
console.log('Project initialized!');`
            },
            nextjs: {
                'package.json': JSON.stringify({
                    name: 'nextjs-project',
                    version: '1.0.0',
                    scripts: {
                        dev: 'next dev',
                        build: 'next build',
                        start: 'next start'
                    }
                }, null, 2),
                '.gitignore': `node_modules/
.next/
out/
.env.local`
            },
            api: {
                'package.json': JSON.stringify({
                    name: 'api-project',
                    version: '1.0.0',
                    scripts: {
                        start: 'node src/index.js',
                        dev: 'nodemon src/index.js'
                    }
                }, null, 2),
                'src/index.js': `const express = require('express');
const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());

app.get('/', (req, res) => {
    res.json({ message: 'API is running!' });
});

app.listen(PORT, () => {
    console.log(\`Server running on port \${PORT}\`);
});`
            },
            python: {
                'requirements.txt': ``,
                'src/main.py': `#!/usr/bin/env python3
# Main application file

def main():
    print("Hello from Python!")

if __name__ == "__main__":
    main()`,
                '.gitignore': `__pycache__/
*.py[cod]
venv/
.env`
            },
            generic: {
                '.gitignore': `node_modules/
.env
dist/
build/`
            }
        };

        return files[projectType] || files.generic;
    }

    /**
     * Generate README.md content
     */
    generateReadme(projectName, projectType, description) {
        const template = this.templates[projectType] || this.templates.generic;
        return template(projectName, description);
    }

    /**
     * Initialize README templates
     */
    initializeTemplates() {
        return {
            website: (name, desc) => `# ${name}

${desc || 'A modern website project'}

## 🚀 Quick Start

### Prerequisites
- A modern web browser
- (Optional) Live Server extension for VS Code

### Running the Project

1. **Option 1: Direct Open**
   - Simply open \`index.html\` in your browser

2. **Option 2: Using Live Server (Recommended)**
   - Right-click on \`index.html\`
   - Select "Open with Live Server"

## 📁 Project Structure

\`\`\`
.
├── index.html          # Main HTML file
├── css/
│   └── style.css      # Stylesheet
├── js/
│   └── script.js      # JavaScript code
├── images/            # Image assets
└── README.md          # This file
\`\`\`

## 🎨 Next Steps with AI (Ctrl+I in VS Code)

Ask your AI assistant to:
- "Add a navigation bar with smooth scrolling"
- "Create a hero section with modern animations"
- "Implement a contact form with validation"
- "Add responsive design for mobile devices"
- "Create a dark mode toggle"

## 📝 Development Tips

- Keep HTML semantic and accessible
- Use CSS variables for theming
- Test on multiple browsers
- Optimize images before adding

---
*Created by GemDesk AI Scaffolder*`,

            nextjs: (name, desc) => `# ${name}

${desc || 'A Next.js application with modern features'}

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm

### Installation & Running

\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev

# Build for production
npm run build

# Start production server
npm start
\`\`\`

Open [http://localhost:3000](http://localhost:3000) in your browser.

## 📁 Project Structure

\`\`\`
.
├── src/
│   ├── app/           # App router pages
│   ├── components/    # React components
│   └── styles/        # CSS/Tailwind styles
├── public/            # Static assets
└── package.json
\`\`\`

## 🎨 Next Steps with AI (Ctrl+I in VS Code)

Ask your AI assistant to:
- "Create a responsive navbar component"
- "Add API routes for data fetching"
- "Implement authentication with NextAuth"
- "Set up Tailwind CSS styling"
- "Create dynamic pages with routing"
- "Add SEO metadata optimization"

---
*Created by GemDesk AI Scaffolder*`,

            api: (name, desc) => `# ${name}

${desc || 'A RESTful API built with Node.js and Express'}

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ and npm

### Installation & Running

\`\`\`bash
# Install dependencies
npm install

# Run development server
npm run dev

# Run production server
npm start
\`\`\`

API will be available at [http://localhost:3000](http://localhost:3000)

## 📁 Project Structure

\`\`\`
.
├── src/
│   ├── routes/        # API routes
│   ├── controllers/   # Request handlers
│   ├── models/        # Data models
│   ├── middleware/    # Custom middleware
│   └── index.js       # Entry point
└── package.json
\`\`\`

---
*Created by GemDesk AI Scaffolder*`,

            python: (name, desc) => `# ${name}

${desc || 'A Python application'}

## 🚀 Quick Start

### Prerequisites
- Python 3.8+
- pip

### Installation & Running

\`\`\`bash
# Create virtual environment
python -m venv venv

# Activate virtual environment
# Windows:
venv\\Scripts\\activate
# Linux/Mac:
source venv/bin/activate

# Install dependencies
pip install -r requirements.txt

# Run the application
python src/main.py
\`\`\`

---
*Created by GemDesk AI Scaffolder*`,

            generic: (name, desc) => `# ${name}

${desc || 'A development project'}

## 🚀 Quick Start

### Getting Started

1. Open this folder in VS Code
2. Press \`Ctrl+I\` to activate AI assistant
3. Describe what you want to build
4. Let AI help you implement it!

---
*Created by GemDesk AI Scaffolder*`
        };
    }
}
