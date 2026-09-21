import app from './app';
import { env } from './config/env';
import { connectDB, disconnectDB } from './config/db';

const startServer = async (): Promise<void> => {
  try {
    console.log('🔄 Initializing Kabadiwala Connect API server...');

    // Connect to MongoDB before accepting traffic
    await connectDB();

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
