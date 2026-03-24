const { upstoxService } = require('../../../services/upstoxService');

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }

    try {
        const positionsData = await upstoxService.getPositions();
        
        res.status(200).json({
            success: true,
            data: positionsData,
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error('Error in positions API:', error);
        res.status(500).json({
            success: false,
            error: error.message,
            timestamp: new Date().toISOString()
        });
    }
}