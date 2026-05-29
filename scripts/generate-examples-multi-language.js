/**
 * Multi-language example code generator for OpenAPI/Swagger spec
 * Generates examples in: cURL, TypeScript, Python, JavaScript, Go, Java, C#
 *
 * Usage: node scripts/generate-examples-multi-language.js
 */

const fs = require('fs');
const path = require('path');

const rootDir = path.resolve(__dirname, '..');
const examplesDir = path.join(rootDir, 'docs', 'examples');

const json = (value) => JSON.stringify(value, null, 2);

const examples = {
  user: {
    id: '2f4d8b5f-91d2-43a1-bd1e-877b4f97d7b9',
    email: 'learner@example.com',
    firstName: 'Ada',
    lastName: 'Lovelace',
    role: 'student',
    status: 'active',
  },
  course: {
    id: '8e4fd4f8-d8f3-46b5-8786-6f7167a654f4',
    title: 'JavaScript Foundations',
    description: 'Learn modern JavaScript from first principles.',
    category: 'programming',
    level: 'beginner',
    price: 3999,
    status: 'published',
  },
  payment: {
    id: 'pay_01JZ0D4R8R2Y3R9H2W6E5R4T1P',
    amount: 3999,
    currency: 'USD',
    status: 'pending',
    providerClientSecret: 'pi_123_secret_456',
  },
};

const apiExamples = [
  {
    title: 'Login',
    method: 'POST',
    path: '/auth/login',
    description: 'Authenticate user and get access token',
    requestBody: {
      email: 'learner@example.com',
      password: 'Password123!',
    },
    response: {
      success: true,
      message: 'Login successful',
      data: {
        accessToken: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
        refreshToken: 'refresh_01JZ0D4R8R2Y3R9H2W6E5R4T1P',
        user: examples.user,
      },
    },
    requiresAuth: false,
  },
  {
    title: 'Register',
    method: 'POST',
    path: '/auth/register',
    description: 'Create a new user account',
    requestBody: {
      email: 'newuser@example.com',
      password: 'SecurePass123!',
      firstName: 'Grace',
      lastName: 'Hopper',
      role: 'student',
    },
    response: {
      success: true,
      message: 'Registration successful',
      data: examples.user,
    },
    requiresAuth: false,
  },
  {
    title: 'List Courses',
    method: 'GET',
    path: '/courses?page=1&limit=20',
    description: 'Retrieve paginated list of courses',
    requestBody: null,
    response: {
      success: true,
      message: 'Courses found',
      data: [examples.course],
    },
    requiresAuth: false,
  },
  {
    title: 'Create Course',
    method: 'POST',
    path: '/courses',
    description: 'Create a new course',
    requestBody: {
      title: 'Advanced TypeScript',
      description: 'Master TypeScript type system and advanced patterns.',
      category: 'programming',
      level: 'advanced',
      price: 5999,
    },
    response: {
      success: true,
      message: 'Course created',
      data: { ...examples.course, title: 'Advanced TypeScript', price: 5999 },
    },
    requiresAuth: true,
  },
  {
    title: 'Search Courses',
    method: 'GET',
    path: '/search?q=javascript&filters={"category":"programming","level":"beginner"}',
    description: 'Search and filter courses',
    requestBody: null,
    response: {
      results: [examples.course],
      total: 1,
      page: 1,
      limit: 20,
      filters: { category: 'programming', level: 'beginner' },
      query: 'javascript',
    },
    requiresAuth: false,
  },
  {
    title: 'Create Payment Intent',
    method: 'POST',
    path: '/payments/create-intent',
    description: 'Create a payment intent for course purchase',
    requestBody: {
      courseId: examples.course.id,
      amount: 3999,
      currency: 'USD',
    },
    response: {
      success: true,
      message: 'Payment intent created',
      data: examples.payment,
    },
    requiresAuth: true,
    headers: {
      'X-Idempotency-Key': 'payment-8e4fd4f8-d8f3-46b5',
    },
  },
];

function generateCurlExample(example) {
  let command = `curl -X ${example.method} "http://localhost:3000${example.path}"`;

  command += ' \\\n  -H "Content-Type: application/json"';

  if (example.requiresAuth) {
    command += ' \\\n  -H "Authorization: Bearer YOUR_ACCESS_TOKEN"';
  }

  if (example.headers) {
    Object.entries(example.headers).forEach(([key, value]) => {
      command += ` \\\n  -H "${key}: ${value}"`;
    });
  }

  if (example.requestBody) {
    command += ` \\\n  -d '${JSON.stringify(example.requestBody)}'`;
  }

  return command;
}

function generateTypeScriptExample(example) {
  const requiresAuth = example.requiresAuth ? `
  headers: {
    'Authorization': \`Bearer \${accessToken}\`,
  },` : '';

  return `import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000',
  headers: {
    'Content-Type': 'application/json',
  },
});

async function ${camelCase(example.title)}() {
  try {
    const response = await apiClient.${example.method.toLowerCase()}('${example.path.split('?')[0]}'${example.requestBody ? `, ${JSON.stringify(example.requestBody)}` : ''}${requiresAuth ? `,
    {${requiresAuth}
    }` : ''});
    
    console.log('Response:', response.data);
    return response.data;
  } catch (error) {
    console.error('Error:', error.response?.data || error.message);
  }
}

// Usage
${camelCase(example.title)}();`;
}

function generatePythonExample(example) {
  const auth = example.requiresAuth
    ? `
  headers = {
      'Authorization': f'Bearer {access_token}',
  }`
    : '';

  return `import requests
import json

def ${snake_case(example.title)}():
    url = "http://localhost:3000${example.path.split('?')[0]}"${auth}
    
    ${example.requestBody ? `data = ${JSON.stringify(example.requestBody, null, 4).split('\n').join('\n    ')}` : 'data = None'}
    
    try:
        response = requests.${example.method.lower()}(url, json=data${example.requiresAuth ? ', headers=headers' : ''})
        response.raise_for_status()
        print("Response:", response.json())
        return response.json()
    except requests.exceptions.RequestException as e:
        print(f"Error: {e}")
        return None

# Usage
if __name__ == "__main__":
    ${snake_case(example.title)}()`;
}

function generateJavaScriptExample(example) {
  const auth = example.requiresAuth ? `
    headers: {
      'Authorization': \`Bearer \${accessToken}\`,
    },` : '';

  return `// Fetch API example (works in Node.js 18+ and browsers)
async function ${camelCase(example.title)}() {
  try {
    const response = await fetch('http://localhost:3000${example.path.split('?')[0]}', {
      method: '${example.method}',
      headers: {
        'Content-Type': 'application/json',${auth}
      },
      ${example.requestBody ? `body: JSON.stringify(${JSON.stringify(example.requestBody)}),` : ''}
    });

    if (!response.ok) {
      throw new Error(\`HTTP error! status: \${response.status}\`);
    }

    const data = await response.json();
    console.log('Response:', data);
    return data;
  } catch (error) {
    console.error('Error:', error);
  }
}

// Usage
${camelCase(example.title)}();`;
}

function generateGoExample(example) {
  const auth = example.requiresAuth
    ? `
	req.Header.Add("Authorization", fmt.Sprintf("Bearer %s", accessToken))`
    : '';

  const reqBody = example.requestBody ? `
	payload := map[string]interface{}{
		${Object.entries(example.requestBody)
      .map(([key, val]) => `"${key}": ${JSON.stringify(val)}`)
      .join(',\n\t\t')}
	}
	body, _ := json.Marshal(payload)
	req, _ := http.NewRequest("${example.method}", "http://localhost:3000${example.path.split('?')[0]}", bytes.NewBuffer(body))` : `
	req, _ := http.NewRequest("${example.method}", "http://localhost:3000${example.path.split('?')[0]}", nil)`;

  return `package main

import (
	"bytes"
	"encoding/json"
	"fmt"
	"io/ioutil"
	"net/http"
)

func ${pascalCase(example.title)}() {
	client := &http.Client{}${reqBody}
	req.Header.Add("Content-Type", "application/json")${auth}

	resp, err := client.Do(req)
	if err != nil {
		fmt.Println("Error:", err)
		return
	}
	defer resp.Body.Close()

	body, _ := ioutil.ReadAll(resp.Body)
	var result interface{}
	json.Unmarshal(body, &result)
	fmt.Println("Response:", result)
}

func main() {
	${camelCase(example.title)}()
}`;
}

function generateJavaExample(example) {
  const auth = example.requiresAuth
    ? `
        connection.setRequestProperty("Authorization", "Bearer " + accessToken);`
    : '';

  return `import java.io.IOException;
import java.net.HttpURLConnection;
import java.net.URL;
import org.json.JSONObject;

public class ${pascalCase(example.title)}Example {
    public static void ${camelCase(example.title)}() throws IOException {
        URL url = new URL("http://localhost:3000${example.path.split('?')[0]}");
        HttpURLConnection connection = (HttpURLConnection) url.openConnection();
        
        connection.setRequestMethod("${example.method}");
        connection.setRequestProperty("Content-Type", "application/json");${auth}
        connection.setDoOutput(true);
        
        ${example.requestBody ? `String jsonInput = "${JSON.stringify(example.requestBody)}";
        try (OutputStream os = connection.getOutputStream()) {
            byte[] input = jsonInput.getBytes("utf-8");
            os.write(input, 0, input.length);
        }` : ''}
        
        int code = connection.getResponseCode();
        System.out.println("Response Code: " + code);
    }
    
    public static void main(String[] args) throws IOException {
        ${camelCase(example.title)}();
    }
}`;
}

function generateCSharpExample(example) {
  const auth = example.requiresAuth
    ? `
            client.DefaultRequestHeaders.Authorization = new AuthenticationHeaderValue("Bearer", accessToken);`
    : '';

  return `using System;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading.Tasks;

public class ${pascalCase(example.title)}Example {
    public static async Task ${pascalCase(example.title)}() {
        using (var client = new HttpClient()) {
            client.BaseAddress = new Uri("http://localhost:3000");${auth}
            
            ${example.requestBody ? `var content = new StringContent(
                JsonSerializer.Serialize(${JSON.stringify(example.requestBody)}),
                Encoding.UTF8,
                "application/json"
            );

            var response = await client.${example.method.ToLower()}Async("${example.path.split('?')[0]}", content);` : `var response = await client.${example.method.toLowerCase()}Async("${example.path.split('?')[0]}");`}
            
            var result = await response.Content.ReadAsStringAsync();
            Console.WriteLine("Response: " + result);
        }
    }

    public static void Main() {
        ${pascalCase(example.title)}().Wait();
    }
}`;
}

// Utility functions
function camelCase(str) {
  return str
    .split(' ')
    .map((word, i) => (i === 0 ? word.toLowerCase() : word.charAt(0).toUpperCase() + word.slice(1).toLowerCase()))
    .join('');
}

function snake_case(str) {
  return str
    .split(' ')
    .map((w) => w.toLowerCase())
    .join('_');
}

function pascalCase(str) {
  return str.split(' ').map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase()).join('');
}

function ensureDir(dir) {
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
}

function writeFile(filePath, content) {
  ensureDir(path.dirname(filePath));
  fs.writeFileSync(filePath, content);
}

function generateIndexMarkdown() {
  let index = `# API Examples

This directory contains example code for calling TeachLink API endpoints in multiple programming languages.

## Table of Contents

${apiExamples.map((ex) => `- [${ex.title}](#${camelCase(ex.title)})`).join('\n')}

## Languages Supported

- **cURL** - Command line HTTP requests
- **TypeScript/Node.js** - Modern async/await pattern
- **Python** - Native HTTP requests library
- **JavaScript** - Fetch API (browser & Node.js 18+)
- **Go** - Native net/http package
- **Java** - HttpURLConnection
- **C#** - HttpClient

---

`;

  apiExamples.forEach((example) => {
    index += `\n## ${example.title}\n\n`;
    index += `**${example.method}** ${example.path}\n\n`;
    index += `${example.description}\n\n`;
    index += `**Requires Authentication:** ${example.requiresAuth ? 'Yes' : 'No'}\n\n`;

    index += `### cURL\n\n\`\`\`bash\n${generateCurlExample(example)}\n\`\`\`\n\n`;
    index += `### Response\n\n\`\`\`json\n${json(example.response)}\n\`\`\`\n\n`;
  });

  return index;
}

function main() {
  ensureDir(examplesDir);

  // Generate index
  writeFile(path.join(examplesDir, 'README.md'), generateIndexMarkdown());

  // Generate language-specific examples
  apiExamples.forEach((example, idx) => {
    const exampleName = `${idx + 1}_${snake_case(example.title)}`;

    // TypeScript
    writeFile(
      path.join(examplesDir, `${exampleName}.ts`),
      generateTypeScriptExample(example),
    );

    // Python
    writeFile(path.join(examplesDir, `${exampleName}.py`), generatePythonExample(example));

    // JavaScript
    writeFile(path.join(examplesDir, `${exampleName}.js`), generateJavaScriptExample(example));

    // Go
    writeFile(path.join(examplesDir, `${exampleName}.go`), generateGoExample(example));

    // Java
    writeFile(
      path.join(examplesDir, `${exampleName}.java`),
      generateJavaExample(example),
    );

    // C#
    writeFile(path.join(examplesDir, `${exampleName}.cs`), generateCSharpExample(example));
  });

  console.log(`✅ Generated ${apiExamples.length} example sets across 7 programming languages`);
  console.log(`   Output: ${path.relative(rootDir, examplesDir)}`);
  console.log(`   Index: ${path.relative(rootDir, path.join(examplesDir, 'README.md'))}`);
}

main();
