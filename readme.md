project-root/
│
├── main.js                   # Electron 메인 프로세스
├── preload.js                # 프리로드 스크립트
├── package.json              # 프로젝트 설정
│
├── openvpn/                  # OpenVPN 실행 파일과 DLL
│   ├── openvpn.exe
│   ├── libcrypto-1_1.dll
│   ├── libssl-1_1.dll
│
├── vpn-configs/              # OpenVPN 서버 설정 파일
│   ├── temp-config.ovpn
│
├── renderer/                 # UI 렌더링 파일
│   ├── index.html
│   ├── style.css
│   └── renderer.js
│
├── scripts/                  # 추가 스크립트
│   └── update-duckdns.js     # DuckDNS 자동 업데이트 스크립트 (필요 시)
│
├── logs/                     # VPN 로그 파일
│   └── vpn-log.txt
│
├── assets/                   # 앱 아이콘
│   └── icon.png
│
└── .env                      # 환경 변수 파일 (보안상 Git에 포함하지 않음)



1.exo vpn 폴더 압축풀기 

2.전체 디텍토리 안에 .env 파일 만들기

3.env 안에에 DUCKDNS_DOMAIN=exovpn
DUCKDNS_TOKEN=8d730d09-95f4-4b9b-9bbe-1b3599d84431
그대로 복사해서 넣기 

터미널(T) 새터미널 CMD
 
또는 파워셀 관리자권한으르 실행 터미널에 cd C:\exovpn 명령어 치고 그후 npm install 명령어 의존성 설치후

마지막 서버실행 명령어 : npm start 