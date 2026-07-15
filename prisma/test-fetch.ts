import { NestFactory } from '@nestjs/core';
import { AppModule } from '../src/app.module';
import { NavigationService } from '../src/routes/navigation/navigation.service';

async function main() {
  const app = await NestFactory.createApplicationContext(AppModule);
  const navigationService = app.get(NavigationService);
  
  const buildingId = '17854b86-79d1-4c60-b776-784742c2597e';
  console.log('Fetching map for building:', buildingId);
  try {
    const data = await navigationService.getBuildingMap(buildingId) as any;
    console.log('Building Name:', data.building.name);
    console.log('Floors count:', data.floors.length);
    if (data.floors.length > 0) {
      const floor = data.floors[0];
      console.log('Floor 1 rooms count:', floor.rooms.length);
      if (floor.rooms.length > 0) {
        console.log('Sample room:', {
          id: floor.rooms[0].id,
          roomCode: floor.rooms[0].roomCode,
          roomLabel: floor.rooms[0].roomLabel,
          centerGeom: floor.rooms[0].centerGeom,
          outlineGeom: floor.rooms[0].outlineGeom,
          boundariesCount: floor.rooms[0].boundaries.length,
        });
      }
    }
  } catch (error) {
    console.error('Error fetching map:', error);
  } finally {
    await app.close();
  }
}

main();
