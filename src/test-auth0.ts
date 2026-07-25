/* eslint-disable no-console */
import { JwtStrategy } from './auth/strategies/jwt.strategy';
import { RolesGuard } from './auth/guards/roles.guard';
import { Reflector } from '@nestjs/core';

// 1. Manually inject mock environment strings for Strategy constructor validation
process.env.AUTH0_AUDIENCE = 'https://api.teachlink.com';
process.env.AUTH0_ISSUER_URL = 'https://dev-teachlink.us.auth0.com/';

async function runVerification() {
  console.log('================================================================');
  console.log('   Auth0 Integration Isolated Verification Script - ts-node     ');
  console.log('================================================================\n');

  try {
    // 2. Instantiate the dynamic JwtStrategy directly
    console.log('[1/3] Instantiating JwtStrategy...');
    const strategy = new JwtStrategy();
    console.log('      JwtStrategy instantiated successfully.\n');

    // 3. Mock a standard decoded Auth0 JWT payload
    const mockPayload = {
      sub: 'auth0|6474df63a76295821df29d3c',
      email: 'security.engineer@teachlink.com',
      email_verified: true,
      name: 'Security Test Engineer',
      'https://api.teachlink.com/roles': ['admin'],
      iss: 'https://dev-teachlink.us.auth0.com/',
      aud: 'https://api.teachlink.com',
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + 3600,
    };

    console.log('[2/3] Mock Decoded Auth0 JWT Payload:');
    console.log(JSON.stringify(mockPayload, null, 2));
    console.log('');

    // 4. Invoke the validate method of the strategy
    console.log('[3/3] Invoking JwtStrategy.validate()...');
    const validatedProfile = await strategy.validate(mockPayload);

    console.log('\n✅ Auth0 JWT Token Validation Successful!');
    console.log('Returned User Profile Object:');
    console.log(JSON.stringify(validatedProfile, null, 2));
    console.log('');

    // 5. Verify the RolesGuard extraction logic
    console.log('[4/4] Verifying RolesGuard custom claim extraction logic...');

    // Instantiate RolesGuard manually with a mock Reflector
    const mockReflector = new Reflector();
    const guard = new RolesGuard(mockReflector);

    // Access the private extractRoles method via type casting to verify it
    const extractedRoles = (guard as any).extractRoles(validatedProfile);
    console.log(`      Extracted roles from token custom claims: [${extractedRoles.join(', ')}]`);

    if (extractedRoles.includes('admin')) {
      console.log('✅ Roles Guard Claims Extraction Successful!');
    } else {
      console.warn('⚠️ Roles Guard Claims Extraction did not extract "admin" role.');
    }
  } catch (error) {
    console.error('\n❌ Verification Failed!');
    console.error(error instanceof Error ? error.stack : String(error));
  }

  console.log('\n================================================================');
}

runVerification();
