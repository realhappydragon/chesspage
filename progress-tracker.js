class ProgressTracker {
    constructor() {
        this.progress = {
            totalXP: 0,
            level: 1,
            lessonsCompleted: {},
            nodesCompleted: {},
            skillTreeProgress: {},
            achievements: [],
            streak: 0,
            lastLessonDate: null,
            stats: {
                totalLessonsCompleted: 0,
                correctMoves: 0,
                totalMoves: 0,
                timeSpent: 0,
                favoriteSkillTree: null
            }
        };
        this.loadProgress();
    }

    loadProgress() {
        try {
            const saved = localStorage.getItem('chess-learning-progress');
            if (saved) {
                const parsed = JSON.parse(saved);
                this.progress = { ...this.progress, ...parsed };
            }
        } catch (error) {
            console.error('Failed to load progress:', error);
        }
    }

    saveProgress() {
        try {
            localStorage.setItem('chess-learning-progress', JSON.stringify(this.progress));
        } catch (error) {
            console.error('Failed to save progress:', error);
        }
    }

    addXP(amount) {
        this.progress.totalXP += amount;
        const newLevel = this.calculateLevel(this.progress.totalXP);
        
        if (newLevel > this.progress.level) {
            this.progress.level = newLevel;
            this.checkAchievements();
            this.saveProgress();
            return { levelUp: true, newLevel };
        }
        
        this.saveProgress();
        return { levelUp: false, newLevel: this.progress.level };
    }

    calculateLevel(xp) {
        // Level formula: Level = floor(sqrt(XP / 100)) + 1
        // Level 1: 0-99 XP, Level 2: 100-399 XP, Level 3: 400-899 XP, etc.
        return Math.floor(Math.sqrt(xp / 100)) + 1;
    }

    getXPForNextLevel() {
        const currentLevel = this.progress.level;
        const xpNeeded = Math.pow(currentLevel, 2) * 100;
        return xpNeeded - this.progress.totalXP;
    }

    markLessonComplete(lessonId, points) {
        if (!this.progress.lessonsCompleted[lessonId]) {
            this.progress.lessonsCompleted[lessonId] = {
                completed: true,
                points: points,
                attempts: 1,
                firstCompletionDate: new Date().toISOString(),
                bestScore: points
            };
            this.progress.stats.totalLessonsCompleted++;
        } else {
            // Update existing record
            const existing = this.progress.lessonsCompleted[lessonId];
            existing.attempts++;
            existing.bestScore = Math.max(existing.bestScore, points);
        }

        this.updateStreak();
        this.checkAchievements();
        this.saveProgress();
    }

    markNodeComplete(nodeId) {
        if (!this.progress.nodesCompleted[nodeId]) {
            this.progress.nodesCompleted[nodeId] = {
                completed: true,
                completionDate: new Date().toISOString()
            };
            this.checkAchievements();
            this.saveProgress();
        }
    }

    isLessonComplete(lessonId) {
        return this.progress.lessonsCompleted[lessonId]?.completed || false;
    }

    isNodeComplete(nodeId) {
        return this.progress.nodesCompleted[nodeId]?.completed || false;
    }

    updateStreak() {
        const today = new Date().toDateString();
        const lastDate = this.progress.lastLessonDate;
        
        if (!lastDate) {
            this.progress.streak = 1;
        } else {
            const lastLessonDate = new Date(lastDate).toDateString();
            const yesterday = new Date(Date.now() - 86400000).toDateString();
            
            if (lastLessonDate === today) {
                // Already counted today
                return;
            } else if (lastLessonDate === yesterday) {
                // Consecutive day
                this.progress.streak++;
            } else {
                // Streak broken
                this.progress.streak = 1;
            }
        }
        
        this.progress.lastLessonDate = today;
    }

    recordMove(isCorrect) {
        this.progress.stats.totalMoves++;
        if (isCorrect) {
            this.progress.stats.correctMoves++;
        }
        this.saveProgress();
    }

    getAccuracy() {
        if (this.progress.stats.totalMoves === 0) return 0;
        return Math.round((this.progress.stats.correctMoves / this.progress.stats.totalMoves) * 100);
    }

    updateSkillTreeProgress(treeId, nodeId) {
        if (!this.progress.skillTreeProgress[treeId]) {
            this.progress.skillTreeProgress[treeId] = {
                nodesCompleted: [],
                totalNodes: 0,
                timeSpent: 0
            };
        }
        
        const treeProgress = this.progress.skillTreeProgress[treeId];
        if (!treeProgress.nodesCompleted.includes(nodeId)) {
            treeProgress.nodesCompleted.push(nodeId);
        }
        
        this.saveProgress();
    }

    getSkillTreeProgress(treeId) {
        return this.progress.skillTreeProgress[treeId] || {
            nodesCompleted: [],
            totalNodes: 0,
            timeSpent: 0
        };
    }

    checkAchievements() {
        const achievements = [];
        
        // Level achievements
        if (this.progress.level >= 5 && !this.hasAchievement('level-5')) {
            achievements.push({
                id: 'level-5',
                name: 'Rising Star',
                description: 'Reached level 5',
                icon: '⭐',
                earned: new Date().toISOString()
            });
        }
        
        if (this.progress.level >= 10 && !this.hasAchievement('level-10')) {
            achievements.push({
                id: 'level-10',
                name: 'Chess Scholar',
                description: 'Reached level 10',
                icon: '🎓',
                earned: new Date().toISOString()
            });
        }

        // Lesson completion achievements
        if (this.progress.stats.totalLessonsCompleted >= 10 && !this.hasAchievement('lessons-10')) {
            achievements.push({
                id: 'lessons-10',
                name: 'Quick Learner',
                description: 'Completed 10 lessons',
                icon: '📚',
                earned: new Date().toISOString()
            });
        }

        if (this.progress.stats.totalLessonsCompleted >= 50 && !this.hasAchievement('lessons-50')) {
            achievements.push({
                id: 'lessons-50',
                name: 'Dedicated Student',
                description: 'Completed 50 lessons',
                icon: '🏆',
                earned: new Date().toISOString()
            });
        }

        // Streak achievements
        if (this.progress.streak >= 7 && !this.hasAchievement('streak-7')) {
            achievements.push({
                id: 'streak-7',
                name: 'Week Warrior',
                description: '7-day learning streak',
                icon: '🔥',
                earned: new Date().toISOString()
            });
        }

        if (this.progress.streak >= 30 && !this.hasAchievement('streak-30')) {
            achievements.push({
                id: 'streak-30',
                name: 'Month Master',
                description: '30-day learning streak',
                icon: '🌟',
                earned: new Date().toISOString()
            });
        }

        // Accuracy achievements
        const accuracy = this.getAccuracy();
        if (accuracy >= 90 && this.progress.stats.totalMoves >= 100 && !this.hasAchievement('accuracy-90')) {
            achievements.push({
                id: 'accuracy-90',
                name: 'Precision Player',
                description: '90% accuracy over 100 moves',
                icon: '🎯',
                earned: new Date().toISOString()
            });
        }

        // Add new achievements
        for (const achievement of achievements) {
            this.progress.achievements.push(achievement);
        }

        return achievements;
    }

    hasAchievement(achievementId) {
        return this.progress.achievements.some(a => a.id === achievementId);
    }

    getRecentAchievements(limit = 5) {
        return this.progress.achievements
            .sort((a, b) => new Date(b.earned) - new Date(a.earned))
            .slice(0, limit);
    }

    exportProgress() {
        return {
            ...this.progress,
            exportDate: new Date().toISOString()
        };
    }

    importProgress(progressData) {
        try {
            // Validate the data structure
            if (progressData && typeof progressData === 'object') {
                this.progress = { ...this.progress, ...progressData };
                this.saveProgress();
                return true;
            }
        } catch (error) {
            console.error('Failed to import progress:', error);
        }
        return false;
    }

    resetProgress() {
        this.progress = {
            totalXP: 0,
            level: 1,
            lessonsCompleted: {},
            nodesCompleted: {},
            skillTreeProgress: {},
            achievements: [],
            streak: 0,
            lastLessonDate: null,
            stats: {
                totalLessonsCompleted: 0,
                correctMoves: 0,
                totalMoves: 0,
                timeSpent: 0,
                favoriteSkillTree: null
            }
        };
        this.saveProgress();
    }

    getProgressSummary() {
        const totalNodes = Object.keys(this.progress.nodesCompleted).length;
        const totalLessons = this.progress.stats.totalLessonsCompleted;
        const accuracy = this.getAccuracy();
        
        return {
            level: this.progress.level,
            totalXP: this.progress.totalXP,
            xpToNextLevel: this.getXPForNextLevel(),
            totalNodes,
            totalLessons,
            accuracy,
            streak: this.progress.streak,
            achievements: this.progress.achievements.length
        };
    }

    startSession() {
        this.sessionStartTime = Date.now();
    }

    endSession() {
        if (this.sessionStartTime) {
            const sessionTime = Date.now() - this.sessionStartTime;
            this.progress.stats.timeSpent += sessionTime;
            this.sessionStartTime = null;
            this.saveProgress();
        }
    }

    getFormattedTimeSpent() {
        const minutes = Math.floor(this.progress.stats.timeSpent / 60000);
        const hours = Math.floor(minutes / 60);
        
        if (hours > 0) {
            return `${hours}h ${minutes % 60}m`;
        } else {
            return `${minutes}m`;
        }
    }

    // Badge system
    getBadgeForLevel(level) {
        if (level >= 20) return '🏅 Grandmaster';
        if (level >= 15) return '👑 Master';
        if (level >= 10) return '🎓 Expert';
        if (level >= 5) return '⭐ Advanced';
        return '📖 Beginner';
    }

    getXPProgress() {
        const currentLevelXP = Math.pow(this.progress.level - 1, 2) * 100;
        const nextLevelXP = Math.pow(this.progress.level, 2) * 100;
        const progressXP = this.progress.totalXP - currentLevelXP;
        const neededXP = nextLevelXP - currentLevelXP;
        
        return {
            current: progressXP,
            needed: neededXP,
            percentage: Math.round((progressXP / neededXP) * 100)
        };
    }
}