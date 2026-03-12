const mongoose = require('mongoose');
const Project = require('../models/Project');
const ProjectTask = require('../models/ProjectTask');
const ProjectMilestone = require('../models/ProjectMilestone');
const Employee = require('../models/Employee');
const ProjectActivityLog = require('../models/ProjectActivityLog');

// ----------------------------------------------------
// 1. PROJECT CRUD
// ----------------------------------------------------

exports.getProjects = async (req, res) => {
    try {
        const projects = await Project.find().populate('owner', 'name email role department').sort({ createdAt: -1 });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getProjectById = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ message: 'Invalid ID' });
        const project = await Project.findById(req.params.id).populate('owner', 'name email role department');
        if (!project) return res.status(404).json({ message: 'Project not found' });

        // Fetch relations
        const tasks = await ProjectTask.find({ project: project._id }).populate('assignee', 'name email').sort({ createdAt: -1 });
        const milestones = await ProjectMilestone.find({ project: project._id }).populate('responsibleTeam', 'name email').sort({ deadline: 1 });
        const activity = await ProjectActivityLog.find({ project: project._id }).populate('actor', 'name').sort({ timestamp: -1 }).limit(20);

        res.json({ project, tasks, milestones, activity });
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.createProject = async (req, res) => {
    try {
        const {
            name, description, owner, department, priority, startDate, deadline, status,
            completionPercentage, healthIndicator, linkedModule, linkedEntityId, tags, notes
        } = req.body;
        const project = new Project({
            name, description, owner, department, priority, startDate, deadline, status,
            completionPercentage, healthIndicator, linkedModule, linkedEntityId, tags, notes,
            projectId: `PRJ-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`
        });
        const savedProject = await project.save();

        await ProjectActivityLog.create({
            project: savedProject._id,
            action: 'Project Created',
            details: `Project ${savedProject.name} was successfully created.`
        });

        res.status(201).json(savedProject);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateProject = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.id))
            return res.status(400).json({ message: 'Invalid ID' });
        const {
            name, description, owner, department, priority, startDate, deadline, status,
            completionPercentage, healthIndicator, linkedModule, linkedEntityId, tags, notes
        } = req.body;
        const oldProject = await Project.findById(req.params.id);
        const updatedProject = await Project.findByIdAndUpdate(
            req.params.id,
            { name, description, owner, department, priority, startDate, deadline, status,
              completionPercentage, healthIndicator, linkedModule, linkedEntityId, tags, notes },
            { new: true }
        );

        if (oldProject.status !== updatedProject.status) {
            await ProjectActivityLog.create({
                project: updatedProject._id,
                action: 'Status Updated',
                details: `Project status changed from ${oldProject.status} to ${updatedProject.status}.`,
                previousState: oldProject.status,
                newState: updatedProject.status
            });
        }

        res.json(updatedProject);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};


// ----------------------------------------------------
// 2. TASK OPERATIONS
// ----------------------------------------------------

exports.createTask = async (req, res) => {
    try {
        const {
            project, title, description, assignee, department, priority, status,
            startDate, deadline, estimatedEffort, actualEffort, linkedEntity, dependencies
        } = req.body;
        const task = new ProjectTask({
            project, title, description, assignee, department, priority, status,
            startDate, deadline, estimatedEffort, actualEffort, linkedEntity, dependencies,
            taskId: `TSK-${Math.floor(Math.random() * 100000).toString().padStart(5, '0')}`
        });
        const savedTask = await task.save();

        await ProjectActivityLog.create({
            project: savedTask.project,
            task: savedTask._id,
            action: 'Task Created',
            details: `Task '${savedTask.title}' was added.`
        });

        res.status(201).json(savedTask);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.updateTask = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.taskId))
            return res.status(400).json({ message: 'Invalid ID' });
        const {
            title, description, assignee, department, priority, status,
            startDate, deadline, estimatedEffort, actualEffort, linkedEntity, dependencies
        } = req.body;
        const oldTask = await ProjectTask.findById(req.params.taskId);
        const updatedTask = await ProjectTask.findByIdAndUpdate(
            req.params.taskId,
            { title, description, assignee, department, priority, status,
              startDate, deadline, estimatedEffort, actualEffort, linkedEntity, dependencies },
            { new: true }
        ).populate('assignee', 'name');

        if (oldTask.status !== updatedTask.status) {
            await ProjectActivityLog.create({
                project: updatedTask.project,
                task: updatedTask._id,
                action: 'Task Moved',
                details: `Task was moved to ${updatedTask.status}.`,
                previousState: oldTask.status,
                newState: updatedTask.status
            });

            // Auto update project completion %
            const allTasks = await ProjectTask.find({ project: updatedTask.project });
            if (allTasks.length > 0) {
                const doneTasks = allTasks.filter(t => t.status === 'Done').length;
                const newPercentage = Math.round((doneTasks / allTasks.length) * 100);
                await Project.findByIdAndUpdate(updatedTask.project, { completionPercentage: newPercentage });
            }
        }

        res.json(updatedTask);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};

exports.addTaskComment = async (req, res) => {
    try {
        if (!mongoose.Types.ObjectId.isValid(req.params.taskId))
            return res.status(400).json({ message: 'Invalid ID' });
        const { text, senderId } = req.body;
        const task = await ProjectTask.findById(req.params.taskId);

        if (!task) return res.status(404).json({ message: 'Task not found' });

        task.comments.push({ text, sender: senderId });
        await task.save();

        res.json(task);
    } catch (error) {
        res.status(400).json({ message: error.message });
    }
};


// ----------------------------------------------------
// 3. ANALYTICS & DASHBOARD AGGREGATION
// ----------------------------------------------------

exports.getGlobalTasks = async (req, res) => {
    try {
        // Find tasks across ALL projects (for Global View)
        const tasks = await ProjectTask.find()
            .populate('project', 'name projectId linkedModule')
            .populate('assignee', 'name email department')
            .sort({ priority: -1, deadline: 1 });

        res.json(tasks);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

exports.getProjectAnalytics = async (req, res) => {
    try {
        const projects = await Project.find();
        const tasks = await ProjectTask.find();

        const metrics = {
            totalProjects: projects.length,
            activeProjects: projects.filter(p => p.status === 'Active').length,
            completedProjects: projects.filter(p => p.status === 'Completed').length,
            averageCompletion: projects.length > 0 ?
                Math.round(projects.reduce((acc, curr) => acc + curr.completionPercentage, 0) / projects.length) : 0,

            taskStatusDistribution: {
                'To Do': tasks.filter(t => t.status === 'To Do').length,
                'In Progress': tasks.filter(t => t.status === 'In Progress').length,
                'In Review': tasks.filter(t => t.status === 'In Review').length,
                'Blocked': tasks.filter(t => t.status === 'Blocked').length,
                'Done': tasks.filter(t => t.status === 'Done').length
            },

            overdueTasks: tasks.filter(t => t.deadline && new Date(t.deadline) < new Date() && t.status !== 'Done').length,

            departmentWorkload: tasks.reduce((acc, curr) => {
                const dept = curr.department || 'General';
                acc[dept] = (acc[dept] || 0) + 1;
                return acc;
            }, {})
        };

        res.json(metrics);

    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};
