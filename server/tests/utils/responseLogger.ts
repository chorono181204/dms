import fs from 'fs';
import path from 'path';

const docsDir = path.join(__dirname, '../../docs/responses');

if (!fs.existsSync(docsDir)) {
    fs.mkdirSync(docsDir, { recursive: true });
}

export const logResponse = (module: string, endpoint: string, method: string, response: any) => {
    const filePath = path.join(docsDir, `${module}.txt`);
    const logEntry = `
========================================
Endpoint: ${method} ${endpoint}
Date: ${new Date().toISOString()}
Response:
${JSON.stringify(response, null, 2)}
========================================
`;
    fs.appendFileSync(filePath, logEntry);
};
