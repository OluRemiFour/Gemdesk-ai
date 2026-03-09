import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Play, 
  Trash2, 
  Plus, 
  Settings, 
  ChevronRight, 
  Zap, 
  Search,
  X,
  PlusCircle
} from 'lucide-react';
import { Button } from './ui/button';
import { ScrollArea } from './ui/scroll-area';
import { Input } from './ui/input';

interface Skill {
    id: string;
    name: string;
    description: string;
    actions: any[];
    category?: string;
}

interface SkillLibraryProps {
    onTriggerSkill: (skill: Skill) => void;
    onClose: () => void;
}

export default function SkillLibrary({ onTriggerSkill, onClose }: SkillLibraryProps) {
    const [skills, setSkills] = useState<Skill[]>([]);
    const [searchQuery, setSearchQuery] = useState('');
    const [isLoading, setIsLoading] = useState(true);

    useEffect(() => {
        loadSkills();
    }, []);

    const loadSkills = async () => {
        setIsLoading(true);
        try {
            if (window.electron && window.electron.listSkills) {
                const result = await window.electron.listSkills();
                if (result.success) {
                    setSkills(result.skills);
                }
            }
        } catch (error) {
            console.error('Failed to load skills:', error);
        } finally {
            setIsLoading(false);
        }
    };

    const deleteSkill = async (id: string) => {
        try {
            if (window.electron && window.electron.deleteSkill) {
                const result = await window.electron.deleteSkill(id);
                if (result.success) {
                    setSkills(prev => prev.filter(s => s.id !== id));
                }
            }
        } catch (error) {
            console.error('Failed to delete skill:', error);
        }
    };

    const filteredSkills = skills.filter(skill => 
        skill.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        skill.description.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <motion.div 
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="absolute inset-0 z-[60] flex items-center justify-center p-6 bg-black/60 backdrop-blur-md"
        >
            <div className="bg-[#111] border border-white/10 rounded-2xl w-full max-w-2xl h-[600px] flex flex-col shadow-2xl overflow-hidden">
                <div className="p-6 border-b border-white/5 flex items-center justify-between bg-white/5">
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-primary/20 rounded-lg">
                            <Zap className="w-5 h-5 text-primary" />
                        </div>
                        <div>
                            <h2 className="text-xl font-bold tracking-tight">Skill Library</h2>
                            <p className="text-xs text-muted-foreground">Repeatable automation workflows</p>
                        </div>
                    </div>
                    <Button variant="ghost" size="icon" onClick={onClose} className="rounded-full hover:bg-white/10">
                        <X className="w-5 h-5" />
                    </Button>
                </div>

                <div className="p-4 bg-black/20 flex gap-4 border-b border-white/5">
                    <div className="relative flex-1">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                        <Input 
                            placeholder="Search skills..." 
                            className="pl-10 bg-white/5 border-white/10"
                            value={searchQuery}
                            onChange={(e) => setSearchQuery(e.target.value)}
                        />
                    </div>
                    <Button variant="outline" className="gap-2 bg-white/5 border-white/10">
                        <PlusCircle className="w-4 h-4" /> Create Skill
                    </Button>
                </div>

                <ScrollArea className="flex-1 p-4">
                    {isLoading ? (
                        <div className="flex flex-col items-center justify-center h-full opacity-50 space-y-4 py-20">
                            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
                            <p>Loading your skills...</p>
                        </div>
                    ) : filteredSkills.length === 0 ? (
                        <div className="flex flex-col items-center justify-center h-full py-20 text-center space-y-4 h-[300px]">
                            <div className="p-4 bg-white/5 rounded-full">
                                <Zap className="w-8 h-8 text-muted-foreground" />
                            </div>
                            <div>
                                <h3 className="font-semibold">No skills found</h3>
                                <p className="text-sm text-muted-foreground mt-1">
                                    {searchQuery ? "Try a different search term" : "Create your first automation workflow to get started"}
                                </p>
                            </div>
                        </div>
                    ) : (
                        <div className="grid grid-cols-1 gap-3">
                            {filteredSkills.map(skill => (
                                <div 
                                    key={skill.id}
                                    className="group relative bg-white/5 border border-white/10 p-4 rounded-xl hover:border-primary/50 transition-all cursor-pointer overflow-hidden"
                                >
                                    <div className="flex items-start justify-between gap-4">
                                        <div className="flex-1">
                                            <h3 className="font-bold text-lg group-hover:text-primary transition-colors">{skill.name}</h3>
                                            <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{skill.description}</p>
                                            <div className="flex gap-2 mt-4">
                                                <span className="text-[10px] px-2 py-1 bg-white/10 rounded-full font-mono text-muted-foreground">
                                                    {skill.actions.length} ACTIONS
                                                </span>
                                                {skill.category && (
                                                    <span className="text-[10px] px-2 py-1 bg-primary/20 text-primary rounded-full font-mono">
                                                        {skill.category.toUpperCase()}
                                                    </span>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex flex-col gap-2">
                                            <Button 
                                                size="sm" 
                                                className="gap-2 bg-primary hover:bg-primary/90"
                                                onClick={() => onTriggerSkill(skill)}
                                            >
                                                <Play className="w-3 h-3 fill-current" /> Run
                                            </Button>
                                            <Button 
                                                variant="ghost" 
                                                size="sm" 
                                                className="h-8 w-8 p-0 text-red-400 hover:text-red-300 hover:bg-red-400/10"
                                                onClick={() => deleteSkill(skill.id)}
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </Button>
                                        </div>
                                    </div>
                                    <div className="absolute right-0 bottom-0 p-4 opacity-5 pointer-events-none group-hover:scale-110 transition-transform">
                                        <Zap className="w-24 h-24 text-primary" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </ScrollArea>
                
                <div className="p-4 bg-white/5 border-t border-white/5 text-center">
                    <p className="text-[10px] text-muted-foreground uppercase tracking-widest">
                        GemDesk Automations Engine v1.0
                    </p>
                </div>
            </div>
        </motion.div>
    );
}
