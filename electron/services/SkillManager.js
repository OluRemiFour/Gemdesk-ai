import fs from 'fs';
import path from 'path';
import os from 'os';

export class SkillManager {
    constructor() {
        this.skillsDir = path.join(os.homedir(), '.gemdesk', 'skills');
        this.ensureSkillsDir();
    }

    ensureSkillsDir() {
        if (!fs.existsSync(this.skillsDir)) {
            fs.mkdirSync(this.skillsDir, { recursive: true });
        }
    }

    async listSkills() {
        try {
            const files = await fs.promises.readdir(this.skillsDir);
            const skills = [];
            for (const file of files) {
                if (file.endsWith('.json')) {
                    const content = await fs.promises.readFile(path.join(this.skillsDir, file), 'utf8');
                    skills.push(JSON.parse(content));
                }
            }
            return { success: true, skills };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async saveSkill(skill) {
        try {
            if (!skill.id) skill.id = Date.now().toString();
            const filePath = path.join(this.skillsDir, `${skill.id}.json`);
            await fs.promises.writeFile(filePath, JSON.stringify(skill, null, 2), 'utf8');
            return { success: true, skill };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }

    async deleteSkill(skillId) {
        try {
            const filePath = path.join(this.skillsDir, `${skillId}.json`);
            if (fs.existsSync(filePath)) {
                await fs.promises.unlink(filePath);
            }
            return { success: true, message: `Skill ${skillId} deleted` };
        } catch (error) {
            return { success: false, error: error.message };
        }
    }
}
