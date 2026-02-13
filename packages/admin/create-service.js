const https = require('https');

const query = `
  mutation ServiceCreate($input: ServiceCreateInput!) {
    serviceCreate(input: $input) {
      id
      name
    }
  }
`;

const variables = {
  input: {
    name: 'winston-admin',
    projectId: '15a7aa96-1d45-4724-9248-b7d09310acdb'
  }
};

const data = JSON.stringify({ query, variables });

const options = {
  hostname: 'backboard.railway.app',
  path: '/graphql/v2',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${process.env.RAILWAY_TOKEN}`,
    'Content-Length': data.length
  }
};

const req = https.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => body += chunk);
  res.on('end', () => {
    console.log(JSON.stringify(JSON.parse(body), null, 2));
  });
});

req.on('error', (error) => {
  console.error(error);
});

req.write(data);
req.end();
