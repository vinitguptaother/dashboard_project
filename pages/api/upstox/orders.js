const { upstoxService } = require('../../../services/upstoxService');

export default async function handler(req, res) {
    if (req.method === 'GET') {
        try {
            const ordersData = await upstoxService.getOrders();
            
            res.status(200).json({
                success: true,
                data: ordersData,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error in orders GET API:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    } else if (req.method === 'POST') {
        try {
            const orderData = req.body;
            
            if (!orderData.instrument_token || !orderData.quantity || !orderData.transaction_type) {
                return res.status(400).json({
                    success: false,
                    error: 'Required fields: instrument_token, quantity, transaction_type',
                    timestamp: new Date().toISOString()
                });
            }

            const orderResult = await upstoxService.placeOrder(orderData);
            
            res.status(200).json({
                success: true,
                data: orderResult,
                timestamp: new Date().toISOString()
            });
        } catch (error) {
            console.error('Error in orders POST API:', error);
            res.status(500).json({
                success: false,
                error: error.message,
                timestamp: new Date().toISOString()
            });
        }
    } else {
        return res.status(405).json({ success: false, message: 'Method not allowed' });
    }
}