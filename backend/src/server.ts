import app from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/db';
import { Material } from './models/Material';

const startServer = async (): Promise<void> => {
  try {
    console.log('🔄 Initializing Kabadiwala Connect API server...');

    // Connect to MongoDB before accepting traffic
    await connectDB();

    // Ensure materials catalog is initialized
    const materialCount = await Material.countDocuments();
    if (materialCount === 0) {
      console.log('📦 Initializing standard materials catalog in database...');
      const defaultMaterials = [
        { name: 'Laptop Scrap', category: 'Computers', pricePerKg: 110, indicativePrice: 110, unit: 'per kg', priceTrend: 'up' as const, description: 'Used and broken laptops, motherboards and components', isActive: true, status: 'active' as const },
        { name: 'Copper Cable', category: 'Cables', pricePerKg: 620, indicativePrice: 620, unit: 'per kg', priceTrend: 'stable' as const, description: 'Stripped and unstripped copper wires and communication cables', isActive: true, status: 'active' as const },
        { name: 'Mobile Phones', category: 'Mobile Devices', pricePerKg: 280, indicativePrice: 280, unit: 'per kg', priceTrend: 'down' as const, description: 'Old, damaged and non-functional mobile handsets and circuit boards', isActive: true, status: 'active' as const },
        { name: 'Lead Battery', category: 'Batteries', pricePerKg: 95, indicativePrice: 95, unit: 'per kg', priceTrend: 'up' as const, description: 'Lead acid batteries from UPS systems and inverters', isActive: true, status: 'active' as const },
        { name: 'Monitor Panel', category: 'Displays', pricePerKg: 45, indicativePrice: 45, unit: 'per kg', priceTrend: 'stable' as const, description: 'CRT displays, LCD panels and desktop monitor chassis', isActive: true, status: 'active' as const },
        { name: 'Printer Circuit Board', category: 'Printers', pricePerKg: 890, indicativePrice: 890, unit: 'per kg', priceTrend: 'up' as const, description: 'High-grade printer motherboards and internal power supplies', isActive: true, status: 'active' as const },
        { name: 'Mixed Electronic Scrap', category: 'Mixed Scrap', pricePerKg: 35, indicativePrice: 35, unit: 'per kg', priceTrend: 'stable' as const, description: 'Unsorted consumer electronics, accessories and mixed components', isActive: true, status: 'active' as const },
      ];
      await Material.create(defaultMaterials);
      console.log('✅ Standard materials catalog initialized.');
    }

    const server = app.listen(env.PORT, () => {
      console.log(`🚀 Server listening on port ${env.PORT} in [${env.NODE_ENV}] mode`);
      console.log(`🔗 Health check available at: http://localhost:${env.PORT}/api/v1/health`);
    });

    // Graceful shutdown handling
    const gracefulShutdown = async (signal: string) => {
      console.log(`\n🛑 Received ${signal}. Starting graceful shutdown...`);
      server.close(async () => {
        console.log('🚪 HTTP server closed');
        await disconnectDB();
        process.exit(0);
      });

      // Force exit after 10 seconds if not closed
      setTimeout(() => {
        console.error('⚠️ Forcing process exit after timeout');
        process.exit(1);
      }, 10000);
    };

    process.on('SIGINT', () => gracefulShutdown('SIGINT'));
    process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
  } catch (error: any) {
    console.error('💥 Fatal error during server startup:');
    console.error(error.message);
    // Explicitly do not continue listening without MongoDB
    process.exit(1);
  }
};

startServer();
