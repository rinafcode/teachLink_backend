import { Injectable, INestApplication } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { PassportModule, PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import * as jwt from 'jsonwebtoken';
import request from 'supertest';
import { ForumController } from './forum.controller';
import { ForumService } from './forum.service';

const JWT_TEST_SECRET = 'forum-controller-spec-secret';

/**
 * Minimal stand-in for the app's real JwtStrategy — just enough for
 * passport-jwt to register a strategy under the 'jwt' name so
 * `AuthGuard('jwt')` has something to consult. A request with no
 * Authorization header is rejected by passport-jwt before `validate()` ever
 * runs, so this is sufficient to prove the guard actually rejects
 * unauthenticated requests rather than to exercise real token verification.
 */
@Injectable()
class TestJwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor() {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      secretOrKey: JWT_TEST_SECRET,
    });
  }

  async validate(payload: { sub: string }) {
    return { id: payload.sub };
  }
}

/**
 * Issue #990 — every forum write handler computed
 * `authorId = req.user?.id || 'anonymous'` with no guard, so unauthenticated
 * callers silently wrote content/votes as a shared 'anonymous' identity
 * instead of being rejected. These tests exercise the real HTTP + guard
 * layer (not a mocked guard) to prove that path is closed.
 */
describe('ForumController (Issue #990 — authenticated forum writes)', () => {
  let app: INestApplication;
  let forumService: {
    createThread: jest.Mock;
    addComment: jest.Mock;
    vote: jest.Mock;
    getThreads: jest.Mock;
    getThread: jest.Mock;
  };

  beforeEach(async () => {
    forumService = {
      createThread: jest.fn().mockResolvedValue({ id: 'thread-1' }),
      addComment: jest.fn().mockResolvedValue({ id: 'comment-1' }),
      vote: jest.fn().mockResolvedValue(undefined),
      getThreads: jest.fn().mockResolvedValue({ data: [], total: 0 }),
      getThread: jest.fn().mockResolvedValue({ id: 'thread-1', comments: { data: [], total: 0 } }),
    };

    const module: TestingModule = await Test.createTestingModule({
      imports: [PassportModule],
      controllers: [ForumController],
      providers: [TestJwtStrategy, { provide: ForumService, useValue: forumService }],
    }).compile();

    app = module.createNestApplication();
    await app.init();
  });

  afterEach(async () => {
    await app.close();
  });

  function signToken(sub: string): string {
    return jwt.sign({ sub }, JWT_TEST_SECRET);
  }

  describe('unauthenticated requests', () => {
    it('rejects POST /forums/threads with 401 and never calls the service', async () => {
      const res = await request(app.getHttpServer())
        .post('/forums/threads')
        .send({ title: 't', content: 'c' });

      expect(res.status).toBe(401);
      expect(forumService.createThread).not.toHaveBeenCalled();
    });

    it('rejects POST /forums/threads/:id/comments with 401', async () => {
      const res = await request(app.getHttpServer())
        .post('/forums/threads/thread-1/comments')
        .send({ content: 'c' });

      expect(res.status).toBe(401);
      expect(forumService.addComment).not.toHaveBeenCalled();
    });

    it('rejects POST /forums/threads/:id/vote with 401 and never calls the service', async () => {
      const res = await request(app.getHttpServer())
        .post('/forums/threads/thread-1/vote')
        .send({ value: 1 });

      expect(res.status).toBe(401);
      expect(forumService.vote).not.toHaveBeenCalled();
    });

    it('rejects POST /forums/comments/:id/vote with 401 and never calls the service', async () => {
      const res = await request(app.getHttpServer())
        .post('/forums/comments/comment-1/vote')
        .send({ value: -1 });

      expect(res.status).toBe(401);
      expect(forumService.vote).not.toHaveBeenCalled();
    });

    it('leaves read endpoints public', async () => {
      const threadsRes = await request(app.getHttpServer()).get('/forums/threads');
      const threadRes = await request(app.getHttpServer()).get('/forums/threads/thread-1');

      expect(threadsRes.status).toBe(200);
      expect(threadRes.status).toBe(200);
    });
  });

  describe('authenticated requests', () => {
    it('creates a thread with the real authenticated user id, never "anonymous"', async () => {
      const token = signToken('user-42');

      const res = await request(app.getHttpServer())
        .post('/forums/threads')
        .set('Authorization', `Bearer ${token}`)
        .send({ title: 't', content: 'c' });

      expect(res.status).toBeLessThan(300);
      expect(forumService.createThread).toHaveBeenCalledWith('t', 'c', 'user-42');
    });

    it('records a vote under the authenticated user id', async () => {
      const token = signToken('user-99');

      const res = await request(app.getHttpServer())
        .post('/forums/threads/thread-1/vote')
        .set('Authorization', `Bearer ${token}`)
        .send({ value: 1 });

      expect(res.status).toBeLessThan(300);
      expect(forumService.vote).toHaveBeenCalledWith('thread', 'thread-1', 'user-99', 1);
    });

    it('rejects a request bearing a token signed with the wrong secret', async () => {
      const badToken = jwt.sign({ sub: 'user-1' }, 'wrong-secret');

      const res = await request(app.getHttpServer())
        .post('/forums/threads')
        .set('Authorization', `Bearer ${badToken}`)
        .send({ title: 't', content: 'c' });

      expect(res.status).toBe(401);
      expect(forumService.createThread).not.toHaveBeenCalled();
    });
  });
});
