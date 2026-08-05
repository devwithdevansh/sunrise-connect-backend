const { Client } = require('ssh2');

const conn = new Client();
conn.on('ready', () => {
  const cmds = [
    'cd domains/linen-weasel-242678.hostingersite.com/nodejs',
    'git pull origin main',
    'mkdir -p tmp && touch tmp/restart.txt'
  ];
  conn.exec(cmds.join(' && '), (err, stream) => {
    if (err) throw err;
    stream.on('close', (code, signal) => {
      conn.end();
    }).on('data', (data) => {
      console.log('STDOUT: ' + data);
    }).stderr.on('data', (data) => {
      console.log('STDERR: ' + data);
    });
  });
}).connect({
  host: '145.79.212.65',
  port: 65002,
  username: 'u804847525',
  password: '#1@Darshan'
});
