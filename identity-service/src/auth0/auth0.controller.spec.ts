import { Test, TestingModule } from '@nestjs/testing';
import { Auth0Controller } from './auth0.controller';

describe('Auth0Controller', () => {
  let controller: Auth0Controller;

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      controllers: [Auth0Controller],
    }).compile();

    controller = module.get<Auth0Controller>(Auth0Controller);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });
});
