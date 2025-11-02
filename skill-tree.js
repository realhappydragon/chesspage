class SkillTreeRenderer {
    constructor(container, progressTracker, lessonEngine) {
        this.container = container;
        this.progressTracker = progressTracker;
        this.lessonEngine = lessonEngine;
        this.skillTrees = {};
        this.currentTree = null;
        this.currentNode = null;
    }

    async initialize() {
        // Load skill trees data
        try {
            const response = await fetch('skill-trees.json');
            this.skillTrees = await response.json();
            this.render();
        } catch (error) {
            console.error('Failed to load skill trees:', error);
        }
    }

    render() {
        this.container.innerHTML = '';
        
        // Create skill tree tabs
        const tabContainer = document.createElement('div');
        tabContainer.className = 'skill-tree-tabs';
        
        Object.values(this.skillTrees).forEach((tree, index) => {
            const tab = document.createElement('button');
            tab.className = `skill-tree-tab ${index === 0 ? 'active' : ''}`;
            tab.innerHTML = `${tree.icon} ${tree.name}`;
            tab.style.backgroundColor = tree.color;
            tab.addEventListener('click', () => this.selectTree(tree.id));
            tabContainer.appendChild(tab);
        });
        
        this.container.appendChild(tabContainer);
        
        // Create tree content area
        const treeContent = document.createElement('div');
        treeContent.className = 'skill-tree-content';
        treeContent.id = 'skill-tree-content';
        this.container.appendChild(treeContent);
        
        // Render first tree by default
        const firstTree = Object.values(this.skillTrees)[0];
        if (firstTree) {
            this.selectTree(firstTree.id);
        }
    }

    selectTree(treeId) {
        // Update active tab
        document.querySelectorAll('.skill-tree-tab').forEach(tab => {
            tab.classList.remove('active');
        });
        event.target.classList.add('active');
        
        this.currentTree = this.skillTrees[treeId];
        this.renderTree(this.currentTree);
    }

    renderTree(tree) {
        const content = document.getElementById('skill-tree-content');
        content.innerHTML = '';
        
        // Tree header
        const header = document.createElement('div');
        header.className = 'tree-header';
        header.innerHTML = `
            <h3>${tree.icon} ${tree.name}</h3>
            <p>${tree.description}</p>
        `;
        content.appendChild(header);
        
        // Tree visualization
        const treeViz = document.createElement('div');
        treeViz.className = 'tree-visualization';
        
        // Calculate tree dimensions
        const maxX = Math.max(...tree.nodes.map(n => n.x));
        const maxY = Math.max(...tree.nodes.map(n => n.y));
        const width = maxX + 150;
        const height = maxY + 150;
        
        treeViz.style.width = `${width}px`;
        treeViz.style.height = `${height}px`;
        treeViz.style.position = 'relative';
        
        // Draw connections first (so they appear behind nodes)
        this.drawConnections(tree, treeViz);
        
        // Draw nodes
        tree.nodes.forEach(node => {
            this.drawNode(node, tree, treeViz);
        });
        
        content.appendChild(treeViz);
    }

    drawConnections(tree, container) {
        const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.style.position = 'absolute';
        svg.style.top = '0';
        svg.style.left = '0';
        svg.style.width = '100%';
        svg.style.height = '100%';
        svg.style.pointerEvents = 'none';
        svg.style.zIndex = '1';
        
        tree.nodes.forEach(node => {
            if (node.prerequisite) {
                const prerequisites = Array.isArray(node.prerequisite) 
                    ? node.prerequisite 
                    : [node.prerequisite];
                
                prerequisites.forEach(prereqId => {
                    const prereqNode = tree.nodes.find(n => n.id === prereqId);
                    if (prereqNode) {
                        this.drawConnection(svg, prereqNode, node, tree.color);
                    }
                });
            }
        });
        
        container.appendChild(svg);
    }

    drawConnection(svg, fromNode, toNode, color) {
        const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
        line.setAttribute('x1', fromNode.x + 50); // Center of node (100px width / 2)
        line.setAttribute('y1', fromNode.y + 50);
        line.setAttribute('x2', toNode.x + 50);
        line.setAttribute('y2', toNode.y + 50);
        line.setAttribute('stroke', color);
        line.setAttribute('stroke-width', '3');
        line.setAttribute('opacity', '0.6');
        
        // Add arrowhead
        const marker = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
        const arrowMarker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
        arrowMarker.setAttribute('id', `arrow-${fromNode.id}-${toNode.id}`);
        arrowMarker.setAttribute('markerWidth', '10');
        arrowMarker.setAttribute('markerHeight', '10');
        arrowMarker.setAttribute('refX', '8');
        arrowMarker.setAttribute('refY', '3');
        arrowMarker.setAttribute('orient', 'auto');
        
        const arrow = document.createElementNS('http://www.w3.org/2000/svg', 'polygon');
        arrow.setAttribute('points', '0 0, 10 3, 0 6');
        arrow.setAttribute('fill', color);
        
        arrowMarker.appendChild(arrow);
        marker.appendChild(arrowMarker);
        svg.appendChild(marker);
        
        line.setAttribute('marker-end', `url(#arrow-${fromNode.id}-${toNode.id})`);
        svg.appendChild(line);
    }

    drawNode(node, tree, container) {
        const nodeElement = document.createElement('div');
        nodeElement.className = 'skill-node';
        nodeElement.style.left = `${node.x}px`;
        nodeElement.style.top = `${node.y}px`;
        nodeElement.style.zIndex = '2';
        
        // Determine node status
        const isCompleted = this.progressTracker.isNodeComplete(node.id);
        const isAvailable = this.isNodeAvailable(node);
        const isLocked = !isAvailable && !isCompleted;
        
        // Apply status classes
        if (isCompleted) {
            nodeElement.classList.add('completed');
        } else if (isAvailable) {
            nodeElement.classList.add('available');
        } else {
            nodeElement.classList.add('locked');
        }
        
        // Node content
        const nodeIcon = document.createElement('div');
        nodeIcon.className = 'node-icon';
        if (isCompleted) {
            nodeIcon.textContent = '✓';
            nodeIcon.style.color = '#27ae60';
        } else if (isLocked) {
            nodeIcon.textContent = '🔒';
            nodeIcon.style.color = '#95a5a6';
        } else {
            nodeIcon.textContent = tree.icon;
            nodeIcon.style.color = tree.color;
        }
        
        const nodeTitle = document.createElement('div');
        nodeTitle.className = 'node-title';
        nodeTitle.textContent = node.name;
        
        const nodeDescription = document.createElement('div');
        nodeDescription.className = 'node-description';
        nodeDescription.textContent = node.description;
        
        nodeElement.appendChild(nodeIcon);
        nodeElement.appendChild(nodeTitle);
        nodeElement.appendChild(nodeDescription);
        
        // Click handler
        if (isAvailable || isCompleted) {
            nodeElement.classList.add('clickable');
            nodeElement.addEventListener('click', () => this.selectNode(node));
        }
        
        // Progress indicator for completed nodes
        if (isCompleted) {
            const progressBadge = document.createElement('div');
            progressBadge.className = 'progress-badge';
            progressBadge.textContent = '★';
            nodeElement.appendChild(progressBadge);
        }
        
        container.appendChild(nodeElement);
    }

    isNodeAvailable(node) {
        if (!node.prerequisite) return true;
        
        const prerequisites = Array.isArray(node.prerequisite) 
            ? node.prerequisite 
            : [node.prerequisite];
        
        return prerequisites.every(prereqId => 
            this.progressTracker.isNodeComplete(prereqId)
        );
    }

    async selectNode(node) {
        this.currentNode = node;
        
        // Load lessons for this node
        try {
            await this.lessonEngine.loadLessonSet(node.lessonFile);
            
            // Switch to lesson view
            this.switchToLessonView();
            
            // Start first lesson
            this.lessonEngine.startLesson(0);
            this.updateLessonUI();
            
        } catch (error) {
            console.error('Failed to load lessons:', error);
            alert('Failed to load lessons for this skill. Please try again.');
        }
    }

    switchToLessonView() {
        document.getElementById('skill-tree-view').style.display = 'none';
        document.getElementById('lesson-view').style.display = 'block';
    }

    switchToSkillTreeView() {
        document.getElementById('skill-tree-view').style.display = 'block';
        document.getElementById('lesson-view').style.display = 'none';
    }

    updateLessonUI() {
        const lesson = this.lessonEngine.getCurrentLesson();
        const progress = this.lessonEngine.getLessonProgress();
        
        if (!lesson) return;
        
        // Update lesson header
        document.getElementById('lesson-title').textContent = lesson.title;
        document.getElementById('lesson-description').textContent = lesson.description;
        document.getElementById('lesson-number').textContent = progress.current;
        document.getElementById('total-lessons').textContent = progress.total;
        document.getElementById('lesson-progress-fill').style.width = `${progress.percentage}%`;
        
        // Update instructions
        document.getElementById('lesson-instructions').textContent = lesson.description;
        
        // Reset UI state
        document.getElementById('lesson-feedback').style.display = 'none';
        document.getElementById('lesson-hint').style.display = 'none';
        document.getElementById('show-hint').style.display = 'block';
        document.getElementById('hint-text').textContent = lesson.hint || '';
        
        // Update navigation buttons
        document.getElementById('prev-lesson').disabled = progress.current === 1;
        
        // Hide feedback buttons
        document.getElementById('next-lesson').style.display = 'none';
        document.getElementById('try-again').style.display = 'none';
    }

    showLessonFeedback(result) {
        const feedbackDiv = document.getElementById('lesson-feedback');
        const contentDiv = document.getElementById('feedback-content');
        
        feedbackDiv.style.display = 'block';
        
        if (result.correct) {
            contentDiv.innerHTML = `
                <div class="feedback-success">
                    <div class="feedback-icon">✅</div>
                    <div class="feedback-text">
                        <h4>Excellent!</h4>
                        <p>${result.message}</p>
                        <div class="points-earned">+${result.points} XP</div>
                    </div>
                </div>
            `;
            document.getElementById('next-lesson').style.display = 'block';
        } else {
            contentDiv.innerHTML = `
                <div class=\"feedback-error\">
                    <div class=\"feedback-icon\">❌</div>
                    <div class=\"feedback-text\">
                        <h4>Not quite right</h4>
                        <p>${result.message}</p>
                    </div>
                </div>
            `;
            document.getElementById('try-again').style.display = 'block';
        }
    }

    showHint() {
        document.getElementById('lesson-hint').style.display = 'block';
        document.getElementById('show-hint').style.display = 'none';
    }

    nextLesson() {
        if (this.lessonEngine.nextLesson()) {
            this.updateLessonUI();
        } else {
            // Lesson set complete!
            this.showLessonSetComplete();
        }
    }

    previousLesson() {
        if (this.lessonEngine.previousLesson()) {
            this.updateLessonUI();
        }
    }

    resetLesson() {
        this.lessonEngine.resetLesson();
        this.updateLessonUI();
    }

    showLessonSetComplete() {
        const contentDiv = document.getElementById('feedback-content');
        contentDiv.innerHTML = `
            <div class=\"lesson-complete\">
                <div class=\"complete-icon\">🎉</div>
                <div class=\"complete-text\">
                    <h3>Skill Mastered!</h3>
                    <p>You've completed all lessons in ${this.currentNode.name}</p>
                    <button id=\"back-to-skills\" class=\"btn btn-primary\">Continue Learning</button>
                </div>
            </div>
        `;
        
        // Mark node as complete
        this.progressTracker.markNodeComplete(this.currentNode.id);
        
        // Update skill tree progress
        this.progressTracker.updateSkillTreeProgress(this.currentTree.id, this.currentNode.id);
        
        // Show achievement if any
        const achievements = this.progressTracker.checkAchievements();
        if (achievements.length > 0) {
            this.showAchievement(achievements[0]);
        }
        
        document.getElementById('back-to-skills').addEventListener('click', () => {
            this.switchToSkillTreeView();
            this.render(); // Re-render to show updated progress
        });
    }

    showAchievement(achievement) {
        const notification = document.getElementById('achievement-notification');
        document.getElementById('achievement-icon').textContent = achievement.icon;
        document.getElementById('achievement-title').textContent = achievement.name;
        document.getElementById('achievement-description').textContent = achievement.description;
        
        notification.style.display = 'block';
        notification.classList.add('show');
        
        setTimeout(() => {
            notification.classList.remove('show');
            setTimeout(() => {
                notification.style.display = 'none';
            }, 300);
        }, 3000);
    }
}