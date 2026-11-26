import { KeepAliveService } from './keep-alive.service';
import * as https from 'https';
import { EventEmitter } from 'events';

jest.mock('https');

describe('KeepAliveService', () => {
  let service: KeepAliveService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new KeepAliveService();
  });

  afterEach(() => {
    service.onApplicationShutdown();
  });

  it('successfully resolves true when the target responds with 200 OK', async () => {
    const mockReq: any = new EventEmitter();
    const mockRes: any = new EventEmitter();
    mockRes.statusCode = 200;
    mockRes.resume = jest.fn();

    (https.get as jest.Mock).mockImplementation((_url, _opts, callback) => {
      callback(mockRes);
      return mockReq;
    });

    const result = await service.pingSelf();
    expect(result).toBe(true);
    expect(mockRes.resume).toHaveBeenCalled();
  });

  it('handles request timeout gracefully without throwing', async () => {
    const mockReq: any = new EventEmitter();
    mockReq.destroy = jest.fn();

    (https.get as jest.Mock).mockImplementation(() => {
      setTimeout(() => mockReq.emit('timeout'), 5);
      return mockReq;
    });

    const result = await service.pingSelf();
    expect(result).toBe(false);
    expect(mockReq.destroy).toHaveBeenCalled();
  });

  it('handles request error gracefully without throwing', async () => {
    const mockReq: any = new EventEmitter();

    (https.get as jest.Mock).mockImplementation(() => {
      setTimeout(() => mockReq.emit('error', new Error('Network failure')), 5);
      return mockReq;
    });

    const result = await service.pingSelf();
    expect(result).toBe(false);
  });
});
