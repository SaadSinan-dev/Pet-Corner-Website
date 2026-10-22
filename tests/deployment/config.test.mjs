import assert from 'node:assert/strict'
import { test } from 'node:test'
import { pagesEnvironment, publicUrl } from '../../scripts/deployment-config.mjs'

const environment = { VITE_API_BASE_URL: 'https://api.pet-corner.app/api/v1/', VITE_SITE_URL: 'https://shop.pet-corner.app' }
test('Pages requires explicit production API and storefront origins', () => {
  assert.throws(() => pagesEnvironment('storefront', {}), /VITE_API_BASE_URL/)
  assert.throws(() => pagesEnvironment('storefront', { ...environment, VITE_SITE_URL: '' }), /VITE_SITE_URL/)
  assert.deepEqual(pagesEnvironment('storefront', environment), { VITE_API_BASE_URL: 'https://api.pet-corner.app/api/v1', VITE_SITE_URL: 'https://shop.pet-corner.app' })
})
test('Pages rejects insecure local credential-bearing placeholder and malformed URLs', () => {
  for (const value of ['http://api.pet-corner.app/api/v1', '/api/v1', 'https://localhost/api/v1', 'https://127.0.0.1/api/v1', 'https://[::1]/api/v1', 'https://192.168.1.2/api/v1', 'https://user:password@api.pet-corner.app/api/v1', 'https://api.example.com/api/v1', 'https://api.pet-corner.app/api/v1?token=secret', 'https://api.pet-corner.app/api/v1#fragment']) {
    assert.throws(() => pagesEnvironment('storefront', { ...environment, VITE_API_BASE_URL: value }), undefined, value)
  }
  assert.throws(() => pagesEnvironment('storefront', { ...environment, VITE_API_BASE_URL: 'https://api.pet-corner.app' }), /api\/v1/)
  assert.throws(() => publicUrl('https://shop.pet-corner.app/path', 'site', true), /origin/)
})
test('independent admin needs its own origin and the correct storefront link', () => {
  const admin = { VITE_ADMIN_API_BASE_URL: environment.VITE_API_BASE_URL, VITE_ADMIN_SITE_URL: 'https://admin.pet-corner.app/', VITE_STOREFRONT_URL: environment.VITE_SITE_URL }
  assert.equal(pagesEnvironment('admin', admin).VITE_ADMIN_SITE_URL, 'https://admin.pet-corner.app')
  assert.throws(() => pagesEnvironment('admin', { ...admin, VITE_STOREFRONT_URL: '' }), /VITE_STOREFRONT_URL/)
  assert.throws(() => pagesEnvironment('admin', { ...admin, VITE_ADMIN_SITE_URL: admin.VITE_STOREFRONT_URL }), /independent/)
})
test('public build variables cannot carry deployment secrets', () => {
  assert.throws(() => pagesEnvironment('storefront', { ...environment, VITE_DATABASE_URL: 'secret' }), /VITE_DATABASE_URL/)
  assert.throws(() => pagesEnvironment('admin', {}), /VITE_ADMIN_API_BASE_URL/)
  assert.throws(() => pagesEnvironment('unknown', environment), /Unknown/)
})
test('public validation excludes dotted local DNS and reserved IPv4 networks', () => {
  for (const value of ['https://localhost./api/v1', 'https://api.internal./api/v1', 'https://198.18.0.1/api/v1', 'https://224.0.0.1/api/v1', 'https://bad..host.app/api/v1']) {
    assert.throws(() => publicUrl(value, 'api'), undefined, value)
  }
})
