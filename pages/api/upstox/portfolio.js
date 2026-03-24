const { upstoxService } = require('../../../services/upstoxService');

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const portfolioData = await upstoxService.getPortfolio();
        
        res.status(200).json({
            success: true,
            data: portfolioData,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in portfolio API:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}