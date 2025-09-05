
import { GreetingService } from '../core/GreetingService';

export function setupRoutes(app) {
  app.get('/api/greeting', (req, res) => {
    const greetingService = new GreetingService();
    const response = greetingService.getGreeting();
    res.json(response);
  });
}
