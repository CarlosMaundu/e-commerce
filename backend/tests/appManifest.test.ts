import request from 'supertest';
import sharp from 'sharp';
import { app, bearer, closePool, createUser, resetDatabase, signIn } from './helpers';

jest.mock('../src/lib/mailer', () => require('./mailerMock').mailerMock());

beforeEach(resetDatabase);
afterAll(closePool);

describe('the installed app', () => {
  test('its manifest uses the shop’s name, never the template’s', async () => {
    const res = await request(app).get('/api/rest/manifest.webmanifest').expect(200);
    expect(res.headers['content-type']).toMatch(/application\/manifest\+json/);
    const m = JSON.parse(res.text);
    expect(m.name).toBe('Carlos Shop');
    expect(m.short_name).toBe('Carlos Shop');
    expect(res.text).not.toMatch(/React|Create React App/);
    expect(m).toMatchObject({ display: 'standalone', start_url: '/', scope: '/' });
    expect(m.icons.map((i: any) => `${i.sizes} ${i.purpose}`)).toEqual([
      '192x192 any', '512x512 any', '192x192 maskable', '512x512 maskable',
    ]);

    // Staff rename the shop: the manifest follows.
    await createUser('boss@example.com', 'admin');
    const { token } = await signIn('boss@example.com');
    await request(app).put('/api/admin/store-settings').set(bearer(token))
      .send({ name: 'Nairobi Market Hall' }).expect(200);
    const renamed = JSON.parse((await request(app).get('/api/rest/manifest.webmanifest')).text);
    expect(renamed.name).toBe('Nairobi Market Hall');
    expect(renamed.short_name).toBe('Nairobi'); // long names are shortened for the home screen
  });

  test('icons are made from the configured logo, at the requested size', async () => {
    // Default (no logo): a brand-coloured icon, still a real PNG.
    const before = JSON.parse((await request(app).get('/api/rest/manifest.webmanifest')).text).icons[0].src;
    const plain = await request(app).get('/api/rest/app-icon/192.png').expect(200);
    expect(plain.headers['content-type']).toBe('image/png');
    expect(await sharp(plain.body).metadata()).toMatchObject({ width: 192, height: 192, format: 'png' });

    // Upload a red logo and set it as the shop's logo.
    await createUser('boss@example.com', 'admin');
    const { token } = await signIn('boss@example.com');
    const red = await sharp({ create: { width: 300, height: 120, channels: 3, background: '#ff0000' } }).png().toBuffer();
    const up = await request(app).post('/api/admin/files').set(bearer(token)).attach('file', red, 'logo.png').expect(201);
    const logo = up.body.data.url;
    await request(app).put('/api/admin/store-settings').set(bearer(token)).send({ logo }).expect(200);

    const icon = await request(app).get('/api/rest/app-icon/512.png').expect(200);
    const img = sharp(icon.body);
    expect(await img.metadata()).toMatchObject({ width: 512, height: 512 });
    const { data } = await img.raw().toBuffer({ resolveWithObject: true });
    const centre = (256 * 512 + 256) * 4;
    expect([data[centre], data[centre + 1], data[centre + 2]]).toEqual([255, 0, 0]); // the logo
    expect([data[0], data[1], data[2]]).toEqual([255, 255, 255]); // on white

    // The manifest's icon links change with the logo, so phones refetch them.
    const m = JSON.parse((await request(app).get('/api/rest/manifest.webmanifest')).text);
    expect(m.icons[0].src).toMatch(/^\/api\/rest\/app-icon\/192\.png\?v=[0-9a-f]{10}$/);
    expect(m.icons[0].src).not.toBe(before);

    await request(app).get('/api/rest/app-icon/77.png').expect(404);
    await request(app).get('/api/rest/app-icon/192.png').expect(200);
    await request(app).get('/api/rest/app-icon/512-maskable.png').expect(200);
  });
});
