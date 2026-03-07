const Project = require('../models/Project');
const Task = require('../models/Task');
const Milestone = require('../models/Milestone');

exports.getProjectMetrics = async (req, res) => {
    try {
        const projects = await Project.find();

        let totalProjects = projects.length;
        let activeProjects = 0;
        let totalCompletion = 0;

        projects.forEach(p => {
            if (p.status === 'Active') activeProjects++;
            totalCompletion += p.completionPercentage;
        });

        const averageCompletion = totalProjects > 0 ? (totalCompletion / totalProjects).toFixed(1) : 0;

        // Get upcoming milestones
        const upcomingMilestones = await Milestone.find({ status: 'Pending' })
            .populate('projectId', 'name')
            .sort({ dueDate: 1 })
            .limit(5);

        // Get basic task breakdown
        const tasks = await Task.find();
        const taskStatusCount = {
            'To Do': 0,
            'In Progress': 0,
            'In Review': 0,
            'Done': 0
        };
        tasks.forEach(t => {
            if (taskStatusCount[t.status] !== undefined) {
                taskStatusCount[t.status]++;
            }
        });

        res.json({
            portfolio: {
                totalProjects,
                activeProjects,
                averageCompletion: Number(averageCompletion)
            },
            upcomingMilestones,
            taskStatusCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};

exports.getProjects = async (req, res) => {
    try {
        const projects = await Project.find()
            .populate('manager', 'name')
            .sort({ deadline: 1 });
        res.json(projects);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
};
