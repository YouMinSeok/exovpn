// main.js
require('dotenv').config(); // 환경 변수 로드
const { app, BrowserWindow, ipcMain } = require('electron');
const { spawn, exec } = require('child_process');
const path = require('path');
const fs = require('fs');
const axios = require('axios');
const os = require('os');

let mainWindow;
let logWindow = null; // 로그 창 변수
let vpnProcess = null;

// DuckDNS 설정
const DUCKDNS_DOMAIN = process.env.DUCKDNS_DOMAIN;
const DUCKDNS_TOKEN = process.env.DUCKDNS_TOKEN;

// VPN 로그 파일 경로
const logDir = path.join(__dirname, 'logs');
if (!fs.existsSync(logDir)) {
    fs.mkdirSync(logDir);
}
const logPath = path.join(logDir, 'vpn-log.txt');
const logStream = fs.createWriteStream(logPath, { flags: 'a' });

// 로그 창 생성 함수
function createLogWindow() {
    if (logWindow) {
        // 이미 로그 창이 열려있는 경우 포커스
        logWindow.focus();
        return;
    }

    logWindow = new BrowserWindow({
        width: 800,
        height: 600,
        title: 'VPN 로그',
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload-log.js'), // 로그 창용 프리로드 스크립트
        },
        frame: false, // 창 프레임 제거
        show: false, // 초기에는 숨김
    });

    logWindow.loadFile(path.join('renderer', 'log.html'));

    // 창이 준비되면 표시
    logWindow.once('ready-to-show', () => {
        logWindow.show();
    });

    // 로그 창이 닫힐 때 변수 초기화
    logWindow.on('closed', () => {
        logWindow = null;
    });
}

// 메인 창 생성 함수
function createWindow() {
    mainWindow = new BrowserWindow({
        width: 800,
        height: 600,
        icon: path.join(__dirname, 'assets', 'icon.png'),
        webPreferences: {
            nodeIntegration: false,
            contextIsolation: true,
            preload: path.join(__dirname, 'preload.js'),
        },
        show: false, // 초기에는 숨김
    });

    mainWindow.loadFile(path.join('renderer', 'index.html'));

    // 창이 준비되면 표시
    mainWindow.once('ready-to-show', () => {
        mainWindow.show();
    });
}

app.whenReady().then(createWindow);

// DuckDNS IP 업데이트 함수
async function updateDuckDNS() {
    try {
        console.log('DuckDNS 업데이트 중...');
        const response = await axios.get(
            `https://www.duckdns.org/update?domains=${DUCKDNS_DOMAIN}&token=${DUCKDNS_TOKEN}&ip=`
        );
        console.log('DuckDNS 업데이트 응답:', response.data);
        return response.data;
    } catch (error) {
        console.error('DuckDNS 업데이트 오류:', error.message);
        throw error;
    }
}

// TAP 어댑터 목록 가져오기 함수
function getTapAdapters() {
    const networkAdapters = os.networkInterfaces();
    const tapAdapters = [];

    for (const adapter in networkAdapters) {
        if (adapter.startsWith('TAP-Windows')) {
            tapAdapters.push(adapter);
        }
    }

    return tapAdapters;
}

// VPN 프로세스가 실행 중인지 확인하는 함수
function isProcessRunning(pid) {
    try {
        process.kill(pid, 0); // 시그널 0은 프로세스가 존재하는지 확인
        return true;
    } catch (e) {
        return false;
    }
}

// 특정 이름의 모든 프로세스 종료 함수 (Windows 전용)
function killProcessByName(processName) {
    return new Promise((resolve, reject) => {
        exec(`taskkill /IM ${processName} /F`, (error, stdout, stderr) => {
            if (error) {
                // 프로세스가 존재하지 않을 경우 오류 무시
                if (error.code === 128) {
                    resolve();
                } else {
                    console.error(`프로세스 종료 오류: ${stderr}`);
                    reject(error);
                }
            } else {
                console.log(`프로세스 '${processName}' 종료됨.`);
                resolve();
            }
        });
    });
}

// OpenVPN 실행 함수
async function startOpenVPN(ovpnFilePath, event) {
    const openvpnPath = path.join(__dirname, 'openvpn', 'openvpn.exe');

    // openvpn.exe 존재 여부 확인
    if (!fs.existsSync(openvpnPath)) {
        event.reply('vpn-status', 'OpenVPN 실행 파일을 찾을 수 없습니다.');
        return;
    }

    try {
        // 기존 OpenVPN 및 관련 프로세스 종료
        await killProcessByName('openvpn.exe');
        await killProcessByName('openvpn.daemon.exe'); // openvpn.daemon.exe가 있다면 종료

        // VPN 프로세스 실행
        vpnProcess = spawn(openvpnPath, ['--config', ovpnFilePath], {
            detached: false, // detached를 false로 설정
            stdio: ['pipe', 'pipe', 'pipe'], // stdin, stdout, stderr를 파이프로 설정
        });

        // 로그 창이 열려있지 않다면 생성
        if (!logWindow) {
            createLogWindow();
        }

        // OpenVPN 로그 실시간 스트리밍
        vpnProcess.stdout.on('data', (data) => {
            const message = data.toString();
            console.log(`OpenVPN stdout: ${message}`);
            logStream.write(message);
            event.reply('vpn-status', message);
            if (logWindow) {
                logWindow.webContents.send('vpn-log', message);
            }
        });

        vpnProcess.stderr.on('data', (data) => {
            const message = data.toString();
            console.error(`OpenVPN stderr: ${message}`);
            logStream.write(`오류: ${message}`);
            event.reply('vpn-status', `오류: ${message}`);
            if (logWindow) {
                logWindow.webContents.send('vpn-log', `오류: ${message}`);
            }
        });

        vpnProcess.on('close', (code, signal) => {
            console.log(`VPN 연결 종료 (코드: ${code}, 신호: ${signal})`);
            logStream.write(`VPN 연결 종료 (코드: ${code}, 신호: ${signal})\n`);
            event.reply('vpn-status', `VPN 연결 종료 (코드: ${code})`);
            if (logWindow) {
                logWindow.webContents.send('vpn-log', `VPN 연결 종료 (코드: ${code})\n`);
                logWindow.close(); // VPN 종료 시 로그 창 닫기
            }

            // TAP 어댑터 상태 확인
            setTimeout(() => {
                const tapAdapters = getTapAdapters();
                if (tapAdapters.length > 1) {
                    console.warn('TAP 어댑터가 여러 개 활성화되어 있습니다.');
                    event.reply('vpn-status', 'TAP 어댑터가 여러 개 활성화되어 있습니다.');
                    // 필요 시 추가적인 처리 (예: 자동으로 어댑터 제거)
                } else {
                    console.log('TAP 어댑터 상태 정상.');
                }
            }, 1000); // 1초 후 확인

            vpnProcess = null;
        });

        vpnProcess.on('error', (error) => {
            console.error(`OpenVPN 프로세스 오류: ${error.message}`);
            logStream.write(`OpenVPN 프로세스 오류: ${error.message}\n`);
            event.reply('vpn-status', `OpenVPN 프로세스 오류: ${error.message}`);
            if (logWindow) {
                logWindow.webContents.send('vpn-log', `오류: ${error.message}`);
            }
            vpnProcess = null;
        });
    } catch (error) {
        console.error(`VPN 시작 오류: ${error.message}`);
        event.reply('vpn-status', `VPN 시작 오류: ${error.message}`);
    }
}

// IPC 핸들러: DuckDNS 업데이트
ipcMain.on('update-duckdns', async (event) => {
    try {
        const response = await updateDuckDNS();
        if (response === 'OK') {
            event.reply('duckdns-updated', 'DuckDNS가 성공적으로 업데이트되었습니다.');
        } else {
            event.reply('duckdns-updated', `DuckDNS 업데이트 실패: ${response}`);
        }
    } catch (error) {
        event.reply('duckdns-updated', `DuckDNS 업데이트 오류: ${error.message}`);
    }
});

// IPC 핸들러: VPN 시작
ipcMain.on('start-vpn', async (event, ovpnFileName) => {
    if (vpnProcess) {
        event.reply('vpn-status', 'VPN이 이미 연결되어 있습니다.');
        return;
    }

    const ovpnFilePath = path.join(__dirname, 'vpn-configs', ovpnFileName);

    // OVPN 파일 존재 여부 확인
    if (!fs.existsSync(ovpnFilePath)) {
        event.reply('vpn-status', 'OVPN 파일이 존재하지 않습니다.');
        return;
    }

    // DuckDNS 업데이트
    try {
        const duckdnsResponse = await updateDuckDNS();
        if (duckdnsResponse !== 'OK') {
            event.reply('vpn-status', `DuckDNS 업데이트 실패: ${duckdnsResponse}`);
            return;
        }
    } catch (error) {
        event.reply('vpn-status', `DuckDNS 업데이트 오류: ${error.message}`);
        return;
    }

    // OpenVPN 실행
    startOpenVPN(ovpnFilePath, event);
});

// IPC 핸들러: 서버 리스트 파일 요청
ipcMain.handle('get-servers', async () => {
    const vpnConfigsDir = path.join(__dirname, 'vpn-configs');
    console.log(`vpnConfigsDir 경로: ${vpnConfigsDir}`); // 디버깅 로그 추가
    if (!fs.existsSync(vpnConfigsDir)) {
        console.error('vpn-configs 폴더가 존재하지 않습니다.');
        return [];
    }
    const files = fs.readdirSync(vpnConfigsDir).filter(file => file.endsWith('.ovpn'));
    console.log('가져온 OVPN 파일 리스트:', files);
    return files;
});

// IPC 핸들러: VPN 종료
ipcMain.on('disconnect-vpn', async (event) => {
    if (vpnProcess) {
        console.log('VPN 연결 종료 요청 중...');
        // OpenVPN 프로세스를 종료
        vpnProcess.kill('SIGINT'); // SIGINT 시그널 보내기

        // 추가적인 프로세스 종료 확인 (openvpn.daemon)
        try {
            await killProcessByName('openvpn.daemon.exe'); // openvpn.daemon.exe가 있다면 종료
        } catch (error) {
            console.error(`openvpn.daemon 종료 오류: ${error.message}`);
        }

        vpnProcess.on('close', (code, signal) => {
            console.log(`VPN 프로세스 종료 (코드: ${code}, 신호: ${signal})`);
            logStream.write(`VPN 프로세스 종료 (코드: ${code}, 신호: ${signal})\n`);
            event.reply('vpn-status', 'VPN 연결이 종료되었습니다.');
            if (logWindow) {
                logWindow.webContents.send('vpn-log', 'VPN 연결이 종료되었습니다.\n');
                logWindow.close(); // VPN 종료 시 로그 창 닫기
            }

            // TAP 어댑터 상태 확인
            setTimeout(() => {
                const tapAdapters = getTapAdapters();
                if (tapAdapters.length > 1) {
                    console.warn('TAP 어댑터가 여러 개 활성화되어 있습니다.');
                    event.reply('vpn-status', 'TAP 어댑터가 여러 개 활성화되어 있습니다.');
                    // 필요 시 추가적인 처리 (예: 자동으로 어댑터 제거)
                } else {
                    console.log('TAP 어댑터 상태 정상.');
                }
            }, 1000); // 1초 후 확인

            vpnProcess = null;
        });

        // 추가적인 프로세스 종료 확인
        setTimeout(() => {
            if (vpnProcess && isProcessRunning(vpnProcess.pid)) {
                console.warn('VPN 프로세스가 여전히 실행 중입니다.');
                event.reply('vpn-status', 'VPN 프로세스가 여전히 실행 중입니다.');
            } else {
                console.log('VPN 프로세스가 완전히 종료되었습니다.');
            }
        }, 2000); // 2초 후 확인

    } else {
        event.reply('vpn-status', 'VPN이 현재 연결되어 있지 않습니다.');
    }
});

// 애플리케이션 종료 시 OpenVPN 프로세스 종료
app.on('before-quit', async () => {
    if (vpnProcess) {
        console.log('애플리케이션 종료 시 VPN 프로세스 종료 중...');
        vpnProcess.kill('SIGINT'); // SIGINT 시그널 보내기

        try {
            await killProcessByName('openvpn.daemon.exe'); // openvpn.daemon.exe가 있다면 종료
        } catch (error) {
            console.error(`openvpn.daemon 종료 오류: ${error.message}`);
        }

        vpnProcess.on('close', () => {
            console.log('VPN 프로세스가 종료되었습니다.');
            logStream.write('VPN 프로세스가 종료되었습니다.\n');
            vpnProcess = null;
        });
    }
});
