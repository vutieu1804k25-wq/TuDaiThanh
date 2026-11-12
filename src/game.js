import { initializeApp } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-app.js";
        import {
            getFirestore, doc, setDoc, getDoc, updateDoc, deleteDoc, onSnapshot,
            collection, query, where, getDocs, runTransaction, limit, arrayUnion
        } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-firestore.js";
        import {
            getAuth, signInAnonymously, onAuthStateChanged
        } from "https://www.gstatic.com/firebasejs/13.1.0/firebase-auth.js";

        const firebaseConfig = {
            apiKey: "AIzaSyDPQMBZoLCBBvfMy1sUnolyo0xbUeRzxJA",
            authDomain: "battle-72466.firebaseapp.com",
            projectId: "battle-72466",
            storageBucket: "battle-72466.firebasestorage.app",
            messagingSenderId: "106410442002",
            appId: "1:106410442002:web:cc15998c3cfec2f53947cb"
        };

        const app = initializeApp(firebaseConfig);
        const db = getFirestore(app);
        const auth = getAuth(app);

        // ================= 0. ĐỊNH DANH NGƯỜI CHƠI (FIREBASE ANONYMOUS AUTH + CHỐNG CHIẾM 4 GHẾ) =================
        let currentUid = null;
        let authInitPromise = null;

        function getOrCreateFallbackUid() {
            const key = "tudaithanh_fallback_uid_v1";
            try {
                let uid = localStorage.getItem(key);
                if (!uid) {
                    const rand = (crypto?.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2));
                    uid = "anon_" + rand + "_" + Date.now().toString(36);
                    localStorage.setItem(key, uid);
                }
                return uid;
            } catch (e) {
                return "anon_" + Math.random().toString(36).slice(2);
            }
        }

        function ensureAuth() {
            if (auth.currentUser) {
                currentUid = auth.currentUser.uid;
                return Promise.resolve(currentUid);
            }
            if (authInitPromise) return authInitPromise;

            authInitPromise = new Promise((resolve) => {
                const unsub = onAuthStateChanged(auth, async (user) => {
                    unsub();
                    if (user) {
                        currentUid = user.uid;
                        resolve(currentUid);
                    } else {
                        try {
                            const cred = await signInAnonymously(auth);
                            currentUid = cred.user.uid;
                            resolve(currentUid);
                        } catch (err) {
                            console.warn("[Auth] Anonymous Auth chưa bật trong Firebase Console, dùng UID trình duyệt dự phòng:", err?.code || err);
                            currentUid = getOrCreateFallbackUid();
                            resolve(currentUid);
                        }
                    }
                });
            });
            return authInitPromise;
        }

        // Khởi tạo Auth ngay khi tải trang
        ensureAuth();

        // ================= 1. TỰ ĐỘNG CĂN CHỈNH KHUNG HÌNH 100% VỪA KHÍT MỌI MÀN HÌNH =================
        let resizeRafId = null;
        function adjustViewportScale() {
            const baseWidth = 684;
            const baseHeight = 768;
            const scaleX = window.innerWidth / baseWidth;
            const scaleY = window.innerHeight / baseHeight;
            const scale = Math.min(1, scaleX, scaleY);
            document.documentElement.style.setProperty('--ui-scale', scale.toFixed(4));
        }

        window.addEventListener('resize', () => {
            if (resizeRafId) cancelAnimationFrame(resizeRafId);
            resizeRafId = requestAnimationFrame(() => {
                resizeRafId = null;
                adjustViewportScale();
            });
        });
        document.addEventListener('fullscreenchange', () => {
            adjustViewportScale();
            updateFullscreenButtonText();
        });
        adjustViewportScale();

        // ================= 2. HỖ TRỢ TOÀN MÀN HÌNH & ẤN ESC ĐỂ THOÁT NGAY LẬP TỨC =================
        if (navigator.keyboard && typeof navigator.keyboard.unlock === 'function') {
            navigator.keyboard.unlock();
        }

        let lastFullScreenToggleAt = 0;
        window.toggleFullScreen = async () => {
            const now = Date.now();
            if (now - lastFullScreenToggleAt < 250) return;
            lastFullScreenToggleAt = now;
            try {
                if (!document.fullscreenElement && !document.webkitFullscreenElement) {
                    const el = document.documentElement;
                    if (el.requestFullscreen) {
                        await el.requestFullscreen();
                    } else if (el.webkitRequestFullscreen) {
                        await el.webkitRequestFullscreen();
                    }
                    if (navigator.keyboard && typeof navigator.keyboard.unlock === 'function') {
                        navigator.keyboard.unlock();
                    }
                } else {
                    if (document.exitFullscreen) {
                        await document.exitFullscreen();
                    } else if (document.webkitExitFullscreen) {
                        await document.webkitExitFullscreen();
                    }
                }
            } catch (e) {
                console.warn("Fullscreen toggle error:", e);
            }
            adjustViewportScale();
            updateFullscreenButtonText();
        };

        function updateFullscreenButtonText() {
            const btn = document.getElementById('fullscreen-btn');
            if (!btn) return;
            const isFs = Boolean(document.fullscreenElement || document.webkitFullscreenElement);
            btn.innerText = isFs ? "✕ THOÁT FULL (ESC)" : "⛶ TOÀN MÀN HÌNH";
        }

        // Bắt sự kiện phím ESC theo đúng thứ tự lớp phủ từ trên xuống dưới:
        // Nếu đang mở Sơ đồ đè lên Bảng xếp hạng -> Ấn ESC sẽ đóng Sơ đồ trước để nhìn lại Bảng xếp hạng
        window.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' || e.keyCode === 27) {
                if (document.fullscreenElement || document.webkitFullscreenElement) {
                    if (document.exitFullscreen) {
                        document.exitFullscreen().catch(() => {});
                    } else if (document.webkitExitFullscreen) {
                        document.webkitExitFullscreen();
                    }
                }
                if (document.getElementById('exit-modal')?.style.display === 'flex') {
                    closeExitModal();
                    return;
                }
                if (document.getElementById('diagram-modal')?.style.display === 'flex') {
                    closeDiagramModal();
                    return;
                }
                if (document.getElementById('ranking-modal')?.style.display === 'flex') {
                    closeRankingModal();
                    return;
                }
                if (document.getElementById('peace-modal')?.style.display === 'flex') {
                    closePeaceModal();
                    return;
                }
                if (isChatOpen) {
                    toggleChatPanel();
                }
            }
        });

        const SESSION_STORAGE_KEY = "tudaithanh_active_session_v5";
        const SAVED_NAME_KEY = "tudaithanh_saved_player_name_v1";
        const MAX_HP = 30;
        const MAX_ACTIONS_PER_TURN = 3;
        const STRATEGY_DURATION = 60; // 60s Chiến lược
        const PREP_DURATION = 5;      // 5s Chuẩn bị trước khi nổ súng
        const RESULT_DURATION = 10;   // 10s Xem kết quả
        const CHAT_MAX_LEN = 50;      // Giới hạn 50 ký tự mỗi tin nhắn

        // Cấu hình chống rác phòng & phát hiện người chơi "ma" (mất kết nối ở phòng chờ)
        const HEARTBEAT_INTERVAL_MS = 15000;      // Cập nhật nhịp tim mỗi 15s
        const GHOST_PLAYER_TIMEOUT_MS = 45000;    // Quá 45s không phản hồi ở phòng chờ -> coi là người chơi "ma"
        const WAITING_ROOM_MAX_AGE_MS = 15 * 60 * 1000; // Phòng chờ quá 15 phút không hoạt động -> dọn dẹp

        const factions = ["ngo", "nguy", "thuc", "oa"];
        const colorLabels = {
            ngo: "THÀNH ĐỎ",
            nguy: "THÀNH VÀNG",
            thuc: "THÀNH TRẮNG",
            oa: "THÀNH LỤC"
        };
        const factionColors = {
            ngo: "#ef4444",   // Đỏ
            nguy: "#facc15",  // Vàng
            thuc: "#f8fafc",  // Trắng
            oa: "#10b981"     // Lục
        };

        const diamondSlots = [
            { x: 330, y: 568 }, // Đỉnh Dưới Cùng (Trước mặt người chơi)
            { x: 92,  y: 330 }, // Đỉnh Bên Trái
            { x: 330, y: 92  }, // Đỉnh Đối Diện
            { x: 568, y: 330 }  // Đỉnh Bên Phải
        ];

        const diagramDiamondSlots = [
            { x: 300, y: 505 },
            { x: 95,  y: 300 },
            { x: 300, y: 95  },
            { x: 505, y: 300 }
        ];

        let roomRef = null;
        let unsubscribeRoom = null;
        let unsubscribeChatMap = {};
        let subscribedChatKeySignature = "";
        let privateChatsMap = {};

        let currentRoomCode = "";
        let myRole = null;
        let myActions = [];
        let roomData = null;
        let lastRenderedTurn = 0;
        let lastAnimatedCombatTurn = 0;
        let endingAutoShown = false;

        let currentLocalSubPhase = "input";
        let visualHp = { ngo: MAX_HP, nguy: MAX_HP, thuc: MAX_HP, oa: MAX_HP };
        let isAnimatingBattle = false;
        let battleSequenceToken = 0;
        let isAdvancingPhase = false;
        let lastGhostCleanupAt = 0;

        // Cờ khóa chống spam nút bấm (Anti-Spam Locks & Cooldowns)
        let isBusyLobbyAction = false;
        let isSubmittingActions = false;
        let isExitingGame = false;
        let isSendingChat = false;
        let lastChatSentAt = 0;
        let isStartingWaitingRoom = false;
        let copyCodeTimer = null;
        let lastDiagramRenderSig = "";
        const lastBoardClickMap = {};

        let activeChatPartner = null;
        let isChatOpen = false;
        let seenMsgCounts = {};

        const svgCache = { shields: {}, arrows: {} };
        const shieldGeometry = {};

        function getPairChannelKey(roleA, roleB) {
            return [roleA, roleB].sort().join("_");
        }

        function getRelativeSlotIndex(roleKey) {
            const myIdx = myRole ? factions.indexOf(myRole) : 0;
            const targetIdx = factions.indexOf(roleKey);
            return (targetIdx - myIdx + 4) % 4;
        }

        function getScreenPos(roleKey) {
            return diamondSlots[getRelativeSlotIndex(roleKey)];
        }

        function getDiagramPos(roleKey) {
            return diagramDiamondSlots[getRelativeSlotIndex(roleKey)];
        }

        // Kiểm tra chính xác một phe có còn sống hay đã bị loại
        function isPlayerEliminated(playerObj, subPhase = "input") {
            if (!playerObj) return true;
            if (subPhase === "prep") {
                const startHp = (typeof playerObj.start_hp === 'number') ? playerObj.start_hp : playerObj.hp;
                return startHp <= 0;
            }
            return (playerObj.hp <= 0) || (playerObj.eliminated_order > 0);
        }

        function isPlayerAlive(playerObj, subPhase = "input") {
            return !isPlayerEliminated(playerObj, subPhase);
        }

        // Làm sạch & xác thực danh sách hành động:
        // - Chặn phe đã bị loại ra lệnh
        // - Chặn tấn công hoặc phòng thủ vào phe đã bị loại
        // - Chặn trùng lặp lệnh trên cùng 1 mục tiêu
        // - Giới hạn tối đa đúng 3 lệnh (chống gian lận mở DevTools gửi 50 lệnh)
        function sanitizePlayerActions(rawActions, attackerRole, playersMap, aliveOverrideMap = null) {
            if (!Array.isArray(rawActions)) return [];
            const isAttackerAlive = aliveOverrideMap
                ? Boolean(aliveOverrideMap[attackerRole])
                : isPlayerAlive(playersMap?.[attackerRole], "input");
            if (!isAttackerAlive) return [];

            const valid = [];
            const seen = new Set();
            for (const act of rawActions) {
                if (!act || typeof act !== 'object') continue;
                const target = act.target;
                const type = act.type;
                if (!factions.includes(target) || target === attackerRole) continue;
                if (type !== 'attack' && type !== 'defend') continue;

                const isTargetAlive = aliveOverrideMap
                    ? Boolean(aliveOverrideMap[target])
                    : isPlayerAlive(playersMap?.[target], "input");
                if (!isTargetAlive) continue;

                const actionKey = `${target}_${type}`;
                if (seen.has(actionKey)) continue;
                seen.add(actionKey);

                valid.push({ target, type });
                if (valid.length >= MAX_ACTIONS_PER_TURN) break;
            }
            return valid;
        }

        function layoutFortressesAndBoard() {
            const center = { x: 330, y: 330 };
            factions.forEach(f => {
                const p = getScreenPos(f);
                const el = document.getElementById(f);
                if (el) {
                    el.style.left = `${p.x}px`;
                    el.style.top = `${p.y}px`;
                }
                const deg = Math.atan2(center.y - p.y, center.x - p.x) * 180 / Math.PI;
                const pivot = document.getElementById(`turret-${f}`);
                if (pivot) pivot.style.transform = `rotate(${deg}deg)`;
            });

            initBoardSVG();
        }

        function initBoardSVG() {
            const container = document.getElementById('svg-board-elements');
            let html = "";

            factions.forEach(sKey => {
                factions.forEach(tKey => {
                    if (sKey === tKey) return;
                    const s = getScreenPos(sKey);
                    const t = getScreenPos(tKey);
                    const dx = t.x - s.x;
                    const dy = t.y - s.y;
                    const dist = Math.hypot(dx, dy);
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const px = -ny;
                    const py = nx;

                    const isCrossCenter = dist > 400;
                    const shieldDist = isCrossCenter ? 104 : 96;
                    const shieldHalfW = isCrossCenter ? 30 : 34;
                    const shieldThick = 12;

                    const scx = s.x + nx * shieldDist;
                    const scy = s.y + ny * shieldDist;
                    const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;

                    shieldGeometry[`${sKey}_${tKey}`] = {
                        cx: scx, cy: scy,
                        x1: scx + px * shieldHalfW,
                        y1: scy + py * shieldHalfW,
                        x2: scx - px * shieldHalfW,
                        y2: scy - py * shieldHalfW,
                        nx, ny, px, py
                    };

                    html += `
                    <g id="shield-${sKey}-${tKey}" class="svg-interactive"
                       transform="translate(${scx}, ${scy}) rotate(${angleDeg})">
                        <rect x="-15" y="${-shieldHalfW - 8}" width="30" height="${(shieldHalfW + 8) * 2}" fill="transparent" />
                        <rect class="visual-elem" x="${-shieldThick/2}" y="${-shieldHalfW}" width="${shieldThick}" height="${shieldHalfW * 2}"
                              fill="#1e293b" stroke="#64748b" stroke-width="3" rx="3" />
                    </g>`;

                    const laneOffset = isCrossCenter ? 11 : 12;
                    const startMargin = shieldDist + 20;
                    const endMargin = shieldDist + 20;

                    const x1 = s.x + nx * startMargin + px * laneOffset;
                    const y1 = s.y + ny * startMargin + py * laneOffset;
                    const x2 = t.x - nx * endMargin + px * laneOffset;
                    const y2 = t.y - ny * endMargin + py * laneOffset;

                    const arrowLen = Math.hypot(x2 - x1, y2 - y1);
                    const arrowAngle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
                    const headLen = 19;
                    const shaftEnd = arrowLen - headLen;
                    const points = `0,-4.2 ${shaftEnd},-4.2 ${shaftEnd},-10.5 ${arrowLen},0 ${shaftEnd},10.5 ${shaftEnd},4.2 0,4.2`;

                    html += `
                    <g id="arrow-${sKey}-${tKey}" class="svg-interactive"
                       transform="translate(${x1}, ${y1}) rotate(${arrowAngle})">
                        <rect x="0" y="-14" width="${arrowLen}" height="28" fill="transparent" />
                        <polygon class="visual-elem" points="${points}" fill="#1e293b" stroke="#64748b" stroke-width="2.5" stroke-linejoin="round" />
                    </g>`;
                });
            });

            container.innerHTML = html;

            factions.forEach(sKey => {
                factions.forEach(tKey => {
                    if (sKey === tKey) return;
                    const sEl = document.getElementById(`shield-${sKey}-${tKey}`);
                    const aEl = document.getElementById(`arrow-${sKey}-${tKey}`);
                    svgCache.shields[`${sKey}_${tKey}`] = sEl;
                    svgCache.arrows[`${sKey}_${tKey}`] = aEl;

                    sEl.addEventListener('click', () => handleBoardActionClick(sKey, tKey, 'defend'));
                    aEl.addEventListener('click', () => handleBoardActionClick(sKey, tKey, 'attack'));
                });
            });

            if (roomData && (currentLocalSubPhase === "input" || currentLocalSubPhase === "prep")) {
                renderPreparationSVG(currentLocalSubPhase);
            }
        }

        // Lưu session theo từng tab (sessionStorage) kết hợp định danh uid để 2 tab không đè session của nhau
        function saveActiveSession(roomCode, role, customName) {
            try {
                const payload = JSON.stringify({
                    roomCode,
                    role,
                    uid: currentUid || null,
                    customName: customName || "",
                    savedAt: Date.now()
                });
                sessionStorage.setItem(SESSION_STORAGE_KEY, payload);
                if (customName) {
                    localStorage.setItem(SAVED_NAME_KEY, customName);
                }
            } catch (e) {}
        }

        function clearActiveSession() {
            try {
                sessionStorage.removeItem(SESSION_STORAGE_KEY);
                localStorage.removeItem("tudaithanh_active_session_v4");
            } catch (e) {}
        }

        async function tryRestoreSessionOnLoad() {
            try {
                const savedName = localStorage.getItem(SAVED_NAME_KEY);
                const lobbyInp = document.getElementById('custom-name');
                if (savedName && lobbyInp && !lobbyInp.value) {
                    lobbyInp.value = savedName;
                }

                await ensureAuth();
                const raw = sessionStorage.getItem(SESSION_STORAGE_KEY);
                if (!raw) return;
                const session = JSON.parse(raw);
                if (!session?.roomCode) return;

                const candidateRef = doc(db, "rooms", session.roomCode);
                const snap = await getDoc(candidateRef);
                if (!snap.exists()) {
                    clearActiveSession();
                    return;
                }

                const data = snap.data();
                roomRef = candidateRef;
                currentRoomCode = session.roomCode;

                const matchedSeatByUid = factions.find(
                    f => data.players?.[f]?.joined && data.players?.[f]?.uid && data.players[f].uid === currentUid
                );
                const roleToRestore = matchedSeatByUid || (
                    session.role && data.players?.[session.role]?.joined &&
                    (!data.players[session.role].uid || data.players[session.role].uid === currentUid)
                        ? session.role
                        : null
                );

                if (roleToRestore) {
                    myRole = roleToRestore;
                    myActions = sanitizePlayerActions(data.players[myRole].actions || [], myRole, data.players);
                    lastRenderedTurn = data.turn || 1;
                    enterDirectGameScreen(session.roomCode);
                } else if (data.phase === "waiting") {
                    setupLobby(session.roomCode);
                } else {
                    clearActiveSession();
                }
            } catch (e) {
                console.warn("Session restore skipped:", e);
            }
        }

        layoutFortressesAndBoard();
        tryRestoreSessionOnLoad();

        function createDefaultPlayerObj(defaultLabel) {
            return {
                uid: null,
                name: defaultLabel,
                hp: MAX_HP,
                start_hp: MAX_HP,
                actions: [],
                ready: false,
                joined: false,
                lastSeen: 0,
                client_ts: 0,
                eliminated_order: 0,
                eliminated_turn: 0,
                eliminated_reason: ""
            };
        }

        function getInitialRoomData(isPublic = false, creatorUid = null, now = Date.now()) {
            return {
                isPublic: isPublic,
                createdBy: creatorUid || currentUid || null,
                turn: 1,
                phase: "waiting",
                phase_start_time: null,
                combat_duration: 3.2,
                eliminated_seq: 0,
                peace_streak: 0,
                will_finish: false,
                finish_type: "normal",
                combat_events: [],
                rankings: [],
                last_result_snapshot: null,
                createdAt: now,
                updatedAt: now,
                players: {
                    ngo: createDefaultPlayerObj("THÀNH ĐỎ"),
                    nguy: createDefaultPlayerObj("THÀNH VÀNG"),
                    thuc: createDefaultPlayerObj("THÀNH TRẮNG"),
                    oa: createDefaultPlayerObj("THÀNH LỤC")
                }
            };
        }

        function getPlayerCustomName(roleKey) {
            const nameLobby = document.getElementById('custom-name')?.value.trim();
            const nameSetup = document.getElementById('setup-custom-name')?.value.trim();
            return (nameSetup || nameLobby || colorLabels[roleKey]).slice(0, 14).toUpperCase();
        }

        // ================= NHỊP TIM (HEARTBEAT) & DỌN DẸP NGƯỜI CHƠI "MA" / PHÒNG CHẾT =================
        function isWaitingPlayerActive(playerObj, roomCreatedAt, now = Date.now()) {
            if (!playerObj || !playerObj.joined) return false;
            const lastBeat = playerObj.lastSeen || roomCreatedAt || 0;
            return (now - lastBeat) <= GHOST_PLAYER_TIMEOUT_MS;
        }

        async function sendPlayerHeartbeat() {
            if (!roomRef || !myRole || !roomData || roomData.phase === "finished") return;
            const now = Date.now();
            try {
                await updateDoc(roomRef, {
                    [`players.${myRole}.lastSeen`]: now,
                    updatedAt: now
                });
            } catch (e) {}
        }

        setInterval(() => {
            if (roomRef && myRole && roomData && roomData.phase !== "finished") {
                sendPlayerHeartbeat();
            }
        }, HEARTBEAT_INTERVAL_MS);

        document.addEventListener('visibilitychange', () => {
            if (document.visibilityState === 'visible' && roomRef && myRole) {
                sendPlayerHeartbeat();
                if (roomData) syncTimelineAndUI();
            }
        });

        async function cleanupGhostPlayersInCurrentWaitingRoom() {
            if (!roomRef || !roomData || roomData.phase !== "waiting") return;
            const now = Date.now();
            if (now - lastGhostCleanupAt < 8000) return;

            const hasGhost = factions.some(f => {
                if (f === myRole) return false;
                const p = roomData.players?.[f];
                return p && p.joined && !isWaitingPlayerActive(p, roomData.createdAt, now);
            });
            if (!hasGhost) return;

            lastGhostCleanupAt = now;
            try {
                await runTransaction(db, async (transaction) => {
                    const snap = await transaction.get(roomRef);
                    if (!snap.exists()) return;
                    const data = snap.data();
                    if (data.phase !== "waiting") return;

                    const updates = {};
                    let changed = false;
                    factions.forEach(f => {
                        if (f === myRole) return;
                        const p = data.players?.[f];
                        if (p && p.joined && !isWaitingPlayerActive(p, data.createdAt, now)) {
                            updates[`players.${f}`] = createDefaultPlayerObj(colorLabels[f]);
                            changed = true;
                        }
                    });
                    if (changed) {
                        updates.updatedAt = now;
                        transaction.update(roomRef, updates);
                    }
                });
            } catch (e) {}
        }

        // ================= HỆ THỐNG MẬT THƯ RIÊNG TƯ (SUBCOLLECTION THEO CẶP 2 NGƯỜI) =================
        function getOtherFactions() {
            if (!myRole) return [];
            return [1, 2, 3].map(offset => {
                const myIdx = factions.indexOf(myRole);
                return factions[(myIdx + offset) % 4];
            });
        }

        function clearPrivateChatSubscriptions() {
            Object.values(unsubscribeChatMap).forEach(unsub => {
                if (typeof unsub === 'function') unsub();
            });
            unsubscribeChatMap = {};
            subscribedChatKeySignature = "";
            privateChatsMap = {};
        }

        function subscribePrivateChatsForRole(roomCode, role) {
            if (!roomCode || !role) return;
            const sig = `${roomCode}_${role}`;
            if (subscribedChatKeySignature === sig) return;

            clearPrivateChatSubscriptions();
            subscribedChatKeySignature = sig;

            const others = [1, 2, 3].map(offset => {
                const idx = factions.indexOf(role);
                return factions[(idx + offset) % 4];
            });

            others.forEach(partner => {
                const chKey = getPairChannelKey(role, partner);
                const chatDocRef = doc(db, "rooms", roomCode, "chats", chKey);
                unsubscribeChatMap[chKey] = onSnapshot(chatDocRef, (snap) => {
                    if (snap.exists()) {
                        const cData = snap.data();
                        privateChatsMap[chKey] = Array.isArray(cData.messages) ? cData.messages : [];
                    } else {
                        privateChatsMap[chKey] = [];
                    }
                    updateUnreadBadges();
                    if (isChatOpen) {
                        renderPrivateChatUI();
                    }
                }, () => {
                    // Fallback nếu rules chưa cho phép hoặc subcollection chưa tạo
                    privateChatsMap[chKey] = privateChatsMap[chKey] || [];
                });
            });
        }

        function getChannelMessages(chKey) {
            if (Array.isArray(privateChatsMap[chKey])) {
                return privateChatsMap[chKey];
            }
            if (roomData?.chats && Array.isArray(roomData.chats[chKey])) {
                return roomData.chats[chKey];
            }
            return [];
        }

        window.toggleChatPanel = () => {
            const panel = document.getElementById('private-chat-panel');
            isChatOpen = !isChatOpen;
            panel.style.display = isChatOpen ? 'flex' : 'none';

            if (isChatOpen && myRole) {
                const others = getOtherFactions();
                if (!activeChatPartner || activeChatPartner === myRole) {
                    activeChatPartner = others[0];
                }
                markChannelAsRead(activeChatPartner);
                renderPrivateChatUI();
                document.getElementById('chat-text-input')?.focus();
            }
        };

        window.selectChatPartner = (partnerKey) => {
            activeChatPartner = partnerKey;
            markChannelAsRead(partnerKey);
            renderPrivateChatUI();
        };

        function markChannelAsRead(partnerKey) {
            if (!myRole || !partnerKey) return;
            const chKey = getPairChannelKey(myRole, partnerKey);
            const msgs = getChannelMessages(chKey);
            seenMsgCounts[chKey] = msgs.length;
            updateUnreadBadges();
        }

        function updateUnreadBadges() {
            if (!myRole) return;
            const others = getOtherFactions();
            let totalUnread = 0;

            others.forEach(partner => {
                const chKey = getPairChannelKey(myRole, partner);
                const msgs = getChannelMessages(chKey);
                const seen = seenMsgCounts[chKey] || 0;
                const newFromPartner = msgs.slice(seen).filter(m => m.sender !== myRole).length;

                if (isChatOpen && activeChatPartner === partner) {
                    seenMsgCounts[chKey] = msgs.length;
                } else {
                    totalUnread += newFromPartner;
                }
            });

            const badge = document.getElementById('total-unread-badge');
            if (badge) {
                if (totalUnread > 0) {
                    badge.style.display = 'flex';
                    badge.innerText = totalUnread > 9 ? '9+' : totalUnread;
                } else {
                    badge.style.display = 'none';
                }
            }
        }

        function renderPrivateChatUI() {
            if (!myRole || !roomData) return;
            const others = getOtherFactions();
            if (!activeChatPartner || !others.includes(activeChatPartner)) {
                activeChatPartner = others[0];
            }

            const tabsContainer = document.getElementById('chat-tabs-container');
            tabsContainer.innerHTML = others.map(pKey => {
                const pName = roomData.players[pKey]?.name || colorLabels[pKey];
                const isAct = (pKey === activeChatPartner);
                const chKey = getPairChannelKey(myRole, pKey);
                const msgs = getChannelMessages(chKey);
                const seen = seenMsgCounts[chKey] || 0;
                const hasUnread = !isAct && msgs.slice(seen).some(m => m.sender !== myRole);

                return `
                <button class="chat-tab-btn ${isAct ? 'active' : ''}"
                        style="--tab-color: ${factionColors[pKey]}"
                        onclick="selectChatPartner('${pKey}')">
                    <span style="color:${factionColors[pKey]}">●</span> ${escapeHtml(pName)}
                    <span class="tab-unread-dot" style="display:${hasUnread ? 'block' : 'none'}"></span>
                </button>`;
            }).join("");

            const partnerName = roomData.players[activeChatPartner]?.name || colorLabels[activeChatPartner];
            document.getElementById('chat-privacy-banner').innerText =
                `🔒 Kênh bí mật riêng biệt giữa bạn và ${partnerName} (Subcollection bảo mật 1-1)`;

            const chKey = getPairChannelKey(myRole, activeChatPartner);
            const msgs = getChannelMessages(chKey);
            const box = document.getElementById('chat-messages-box');

            if (msgs.length === 0) {
                box.innerHTML = `<div class="chat-empty-hint">Chưa có mật thư nào với <strong>${escapeHtml(partnerName)}</strong>.<br>Hãy chọn câu gợi ý bên dưới hoặc nhập tin nhắn!</div>`;
            } else {
                box.innerHTML = msgs.map(m => {
                    const isMine = (m.sender === myRole);
                    const sName = isMine ? "Bạn" : (roomData.players[m.sender]?.name || colorLabels[m.sender]);
                    return `
                    <div class="chat-msg ${isMine ? 'mine' : 'theirs'}">
                        <span class="chat-msg-sender" style="color:${isMine ? '#e0f2fe' : factionColors[m.sender]}">${escapeHtml(sName)}</span>
                        ${escapeHtml(m.text)}
                    </div>`;
                }).join("");
                box.scrollTop = box.scrollHeight;
            }

            const presetsBar = document.getElementById('chat-presets-bar');
            const thirdParties = others.filter(k => k !== activeChatPartner && isPlayerAlive(roomData.players[k], "input"));
            let presets = [];

            thirdParties.forEach(tp => {
                const tpName = roomData.players[tp]?.name || colorLabels[tp];
                presets.push(`Tấn công ${tpName}`);
                presets.push(`Phòng thủ ${tpName}`);
            });
            if (isPlayerAlive(roomData.players[activeChatPartner], "input")) {
                presets.push(`Phòng thủ ${partnerName}`);
            }
            presets.push(`Hòa bình nhé!`);
            presets.push(`Đừng bắn tôi!`);
            presets.push(`Hợp tác cùng thắng!`);

            presetsBar.innerHTML = presets.map(txt => {
                const clipped = txt.slice(0, CHAT_MAX_LEN);
                const safeAttr = clipped.replace(/'/g, "\\'");
                return `<button type="button" class="preset-chip" onclick="sendPresetMessage('${safeAttr}')">${escapeHtml(clipped)}</button>`;
            }).join("");
        }

        function escapeHtml(str) {
            return String(str || "")
                .replace(/&/g, "&amp;")
                .replace(/</g, "&lt;")
                .replace(/>/g, "&gt;")
                .replace(/"/g, "&quot;");
        }

        window.updateChatCharCounter = () => {
            const inp = document.getElementById('chat-text-input');
            const counter = document.getElementById('chat-char-counter');
            if (inp && counter) {
                counter.innerText = `${inp.value.length}/${CHAT_MAX_LEN}`;
            }
        };

        window.sendPresetMessage = async (presetText) => {
            await dispatchChatMessage(presetText);
        };

        window.sendPrivateChatMessage = async () => {
            const inp = document.getElementById('chat-text-input');
            if (!inp) return;
            const text = inp.value.trim().slice(0, CHAT_MAX_LEN);
            if (!text) return;
            if (isSendingChat || (Date.now() - lastChatSentAt < 300)) return;
            inp.value = "";
            updateChatCharCounter();
            await dispatchChatMessage(text);
        };

        async function dispatchChatMessage(text) {
            if (!currentRoomCode || !myRole || !activeChatPartner || !text) return;
            const now = Date.now();
            if (isSendingChat || (now - lastChatSentAt < 300)) return;
            const cleanText = text.trim().slice(0, CHAT_MAX_LEN);
            if (!cleanText) return;

            isSendingChat = true;
            lastChatSentAt = now;
            try {
                await ensureAuth();
                const chKey = getPairChannelKey(myRole, activeChatPartner);
                const myUid = roomData?.players?.[myRole]?.uid || currentUid || "";
                const partnerUid = roomData?.players?.[activeChatPartner]?.uid || "";
                const msgObj = {
                    sender: myRole,
                    senderUid: myUid,
                    recipient: activeChatPartner,
                    text: cleanText,
                    ts: Date.now()
                };

                const chatDocRef = doc(db, "rooms", currentRoomCode, "chats", chKey);
                await setDoc(chatDocRef, {
                    channelKey: chKey,
                    roles: [myRole, activeChatPartner].sort(),
                    uids: [myUid, partnerUid].filter(Boolean),
                    updatedAt: Date.now(),
                    messages: arrayUnion(msgObj)
                }, { merge: true });
            } catch (e) {
                console.error("Send chat error:", e);
            } finally {
                isSendingChat = false;
            }
        }

        // ================= TẠO PHÒNG AN TOÀN (TRANSACTION + CHECK EXISTS + RETRY) =================
        async function createUniqueRoomWithTransaction(isPublic = false, autoJoinRole = null) {
            await ensureAuth();
            const maxAttempts = 12;

            for (let attempt = 0; attempt < maxAttempts; attempt++) {
                const rCode = Math.floor(100000 + Math.random() * 900000).toString();
                const candidateRef = doc(db, "rooms", rCode);

                try {
                    await runTransaction(db, async (transaction) => {
                        const existingSnap = await transaction.get(candidateRef);
                        if (existingSnap.exists()) {
                            throw new Error("ROOM_CODE_COLLISION");
                        }

                        const now = Date.now();
                        const initData = getInitialRoomData(isPublic, currentUid, now);

                        if (autoJoinRole && factions.includes(autoJoinRole)) {
                            initData.players[autoJoinRole].joined = true;
                            initData.players[autoJoinRole].uid = currentUid;
                            initData.players[autoJoinRole].name = getPlayerCustomName(autoJoinRole);
                            initData.players[autoJoinRole].lastSeen = now;
                        }

                        transaction.set(candidateRef, initData);
                    });

                    return { roomCode: rCode, ref: candidateRef };
                } catch (err) {
                    if (err && err.message === "ROOM_CODE_COLLISION") {
                        continue;
                    }
                    throw err;
                }
            }

            throw new Error("Không thể cấp phát mã phòng mới sau nhiều lần thử!");
        }

        // ================= GHÉP PHÒNG NHANH (CHỐNG PHÒNG CHẾT, DỌN RÁC TTL, KIỂM TRA HEARTBEAT) =================
        window.quickMatch = async () => {
            if (isBusyLobbyAction) return;
            isBusyLobbyAction = true;
            const btn = document.getElementById('btn-quick-match');
            const originalText = btn ? btn.innerText : "⚡ GHÉP PHÒNG NHANH (ONLINE)";
            if (btn) {
                btn.disabled = true;
                btn.innerText = "🔍 ĐANG TÌM ĐẠI THÀNH...";
            }

            try {
                await ensureAuth();
                const now = Date.now();
                const roomsCol = collection(db, "rooms");
                const q = query(roomsCol, where("phase", "==", "waiting"), limit(25));
                const snap = await getDocs(q);

                let matchedRoomCode = null;
                let assignedRole = null;

                // Sắp xếp ưu tiên các phòng mới tạo gần nhất
                const sortedDocs = [...snap.docs].sort((a, b) => {
                    return (b.data().createdAt || 0) - (a.data().createdAt || 0);
                });

                for (const docSnap of sortedDocs) {
                    const rData = docSnap.data();
                    const createdAt = rData.createdAt || 0;
                    const roomAge = now - createdAt;

                    // Kiểm tra xem phòng chờ còn người chơi thực sự đang online (heartbeat mới) hay không
                    const activeRoles = factions.filter(f => isWaitingPlayerActive(rData.players?.[f], createdAt, now));

                    // Nếu phòng đã quá hạn TTL hoặc toàn bộ người trong phòng đều là "người ma" -> Xoá phòng rác và bỏ qua!
                    if (roomAge > WAITING_ROOM_MAX_AGE_MS || activeRoles.length === 0) {
                        deleteDoc(docSnap.ref).catch(() => {});
                        continue;
                    }

                    if (rData.isPublic === false) continue;

                    try {
                        await runTransaction(db, async (transaction) => {
                            const freshSnap = await transaction.get(docSnap.ref);
                            if (!freshSnap.exists()) throw new Error("Room gone");
                            const freshData = freshSnap.data();
                            if (freshData.phase !== "waiting") throw new Error("Started");

                            const txNow = Date.now();
                            const freshCreatedAt = freshData.createdAt || 0;
                            if (txNow - freshCreatedAt > WAITING_ROOM_MAX_AGE_MS) {
                                transaction.delete(docSnap.ref);
                                throw new Error("Expired");
                            }

                            const players = freshData.players || {};
                            // Dọn dẹp ngay các ghế "ma" (mất kết nối > 45s) trong phòng chờ này
                            factions.forEach(f => {
                                if (players[f]?.joined && !isWaitingPlayerActive(players[f], freshCreatedAt, txNow)) {
                                    players[f] = createDefaultPlayerObj(colorLabels[f]);
                                }
                            });

                            const activeCountBefore = factions.filter(f => players[f]?.joined).length;
                            if (activeCountBefore === 0) {
                                transaction.delete(docSnap.ref);
                                throw new Error("Empty ghost room");
                            }

                            // Nếu người chơi này (cùng uid) đã có ghế trong phòng thì vào lại đúng ghế đó (chống 1 người mở 4 tab chiếm 4 ghế)
                            const existingRoleForUid = factions.find(f => players[f]?.joined && players[f]?.uid === currentUid);
                            const roleToClaim = existingRoleForUid || factions.find(f => !players[f]?.joined);
                            if (!roleToClaim) throw new Error("Full");

                            const finalName = getPlayerCustomName(roleToClaim);
                            players[roleToClaim].joined = true;
                            players[roleToClaim].uid = currentUid;
                            players[roleToClaim].name = finalName;
                            players[roleToClaim].hp = MAX_HP;
                            players[roleToClaim].start_hp = MAX_HP;
                            players[roleToClaim].lastSeen = txNow;

                            const currentJoinedCount = factions.filter(f => players[f]?.joined).length;
                            const updates = {
                                players: players,
                                updatedAt: txNow
                            };

                            if (currentJoinedCount === 4) {
                                updates.phase = "input";
                                updates.phase_start_time = txNow;
                            }

                            transaction.update(docSnap.ref, updates);
                            assignedRole = roleToClaim;
                            matchedRoomCode = docSnap.id;
                        });
                        if (matchedRoomCode) break;
                    } catch (e) {}
                }

                if (!matchedRoomCode) {
                    const created = await createUniqueRoomWithTransaction(true, "ngo");
                    roomRef = created.ref;
                    matchedRoomCode = created.roomCode;
                    assignedRole = "ngo";
                } else {
                    roomRef = doc(db, "rooms", matchedRoomCode);
                }

                myRole = assignedRole;
                currentRoomCode = matchedRoomCode;
                saveActiveSession(matchedRoomCode, myRole, getPlayerCustomName(myRole));
                enterDirectGameScreen(matchedRoomCode);

            } catch (err) {
                console.error(err);
                alert("Lỗi kết nối máy chủ ghép trận. Vui lòng thử lại!");
                if (btn) {
                    btn.disabled = false;
                    btn.innerText = originalText;
                }
            } finally {
                isBusyLobbyAction = false;
            }
        };

        window.createRoom = async (isPublic = false) => {
            if (isBusyLobbyAction) return;
            isBusyLobbyAction = true;
            try {
                const created = await createUniqueRoomWithTransaction(isPublic, null);
                roomRef = created.ref;
                setupLobby(created.roomCode);
            } catch (e) {
                console.error("Create room error:", e);
                alert("Không thể tạo phòng mới. Vui lòng thử lại!");
            } finally {
                isBusyLobbyAction = false;
            }
        };

        window.enterRoom = async () => {
            if (isBusyLobbyAction) return;
            const rCode = document.getElementById('room-code').value.trim();
            if (!/^\d{6}$/.test(rCode)) return alert("Vui lòng nhập đúng mã phòng 6 số!");

            isBusyLobbyAction = true;
            try {
                await ensureAuth();
                roomRef = doc(db, "rooms", rCode);
                const snap = await getDoc(roomRef);

                if (!snap.exists()) return alert("Mã phòng không tồn tại!");
                const data = snap.data();

                // Nếu người chơi đã có ghế trong phòng này (theo uid), cho vào thẳng ghế đó
                const existingSeat = factions.find(f => data.players?.[f]?.joined && data.players?.[f]?.uid === currentUid);
                if (existingSeat) {
                    myRole = existingSeat;
                    currentRoomCode = rCode;
                    myActions = sanitizePlayerActions(data.players[myRole].actions || [], myRole, data.players);
                    saveActiveSession(rCode, myRole, data.players[myRole].name);
                    enterDirectGameScreen(rCode);
                    return;
                }

                if (data.phase !== "waiting") {
                    return alert("Phòng này đã bắt đầu hoặc đã kết thúc!");
                }
                setupLobby(rCode);
            } catch (e) {
                console.error("Enter room error:", e);
                alert("Lỗi kết nối khi vào phòng. Vui lòng thử lại!");
            } finally {
                isBusyLobbyAction = false;
            }
        };

        window.backToLobbyFromSetup = async () => {
            if (isBusyLobbyAction) return;
            isBusyLobbyAction = true;
            try {
                if (unsubscribeRoom) {
                    unsubscribeRoom();
                    unsubscribeRoom = null;
                }
                clearPrivateChatSubscriptions();

                // Nếu phòng riêng vừa tạo chưa có ai chọn phe nào -> dọn dẹp để tránh sinh phòng rác
                if (roomRef && !myRole) {
                    const refToClean = roomRef;
                    runTransaction(db, async (tx) => {
                        const snap = await tx.get(refToClean);
                        if (!snap.exists()) return;
                        const d = snap.data();
                        const anyJoined = factions.some(f => d.players?.[f]?.joined);
                        if (d.phase === "waiting" && !anyJoined && (!d.createdBy || d.createdBy === currentUid)) {
                            tx.delete(refToClean);
                        }
                    }).catch(() => {});
                }

                clearActiveSession();
                myRole = null;
                roomRef = null;
                currentRoomCode = "";
                document.getElementById('setup-screen').style.display = 'none';
                document.getElementById('lobby-screen').style.display = 'block';
            } finally {
                isBusyLobbyAction = false;
            }
        };

        window.copyRoomCode = () => {
            if (!currentRoomCode) return;
            navigator.clipboard?.writeText(currentRoomCode);
            const badge = document.getElementById('wait-room-code');
            if (!badge) return;
            badge.innerText = `ĐÃ SAO CHÉP: ${currentRoomCode} ✅`;
            if (copyCodeTimer) clearTimeout(copyCodeTimer);
            copyCodeTimer = setTimeout(() => {
                copyCodeTimer = null;
                if (currentRoomCode) {
                    badge.innerText = `MÃ PHÒNG: ${currentRoomCode} 📋`;
                }
            }, 1500);
        };

        function enterDirectGameScreen(rCode) {
            layoutFortressesAndBoard();
            adjustViewportScale();
            document.getElementById('lobby-screen').style.display = 'none';
            document.getElementById('setup-screen').style.display = 'none';
            document.getElementById('game-screen').style.display = 'flex';
            document.getElementById('room-code-hud').innerText = `PHÒNG: ${rCode}`;
            document.getElementById('wait-room-code').innerText = `MÃ PHÒNG: ${rCode} 📋`;
            subscribeRoom();
            if (myRole) {
                subscribePrivateChatsForRole(rCode, myRole);
            }
        }

        function setupLobby(rCode) {
            currentRoomCode = rCode;
            saveActiveSession(rCode, null, "");
            const lobbyName = document.getElementById('custom-name').value.trim();
            if (lobbyName) document.getElementById('setup-custom-name').value = lobbyName;

            document.getElementById('lobby-screen').style.display = 'none';
            document.getElementById('setup-screen').style.display = 'block';
            document.getElementById('room-title').innerText = "MÃ PHÒNG: " + rCode;
            document.getElementById('room-code-hud').innerText = `PHÒNG: ${rCode}`;
            document.getElementById('wait-room-code').innerText = `MÃ PHÒNG: ${rCode} 📋`;
            subscribeRoom();
        }

        function subscribeRoom() {
            if (unsubscribeRoom) unsubscribeRoom();

            const btnLabels = {
                ngo: "🔴 THÀNH ĐỎ",
                nguy: "🟡 THÀNH VÀNG",
                thuc: "⚪ THÀNH TRẮNG",
                oa: "🟢 THÀNH LỤC"
            };

            unsubscribeRoom = onSnapshot(roomRef, (snapshot) => {
                if (!snapshot.exists()) {
                    if (currentRoomCode && (!roomData || roomData.phase === "waiting")) {
                        leaveFinishedGame();
                    }
                    return;
                }
                roomData = snapshot.data();

                if (!myRole) {
                    const alreadyClaimedRole = factions.find(
                        f => roomData.players?.[f]?.joined && roomData.players?.[f]?.uid && roomData.players[f].uid === currentUid
                    );
                    factions.forEach(f => {
                        const btn = document.getElementById(`btn-${f}`);
                        const p = roomData.players[f];
                        if (p.joined) {
                            if (alreadyClaimedRole === f) {
                                btn.disabled = false;
                                btn.innerText = `${p.name} (Ghế của bạn - Vào lại)`;
                            } else {
                                btn.disabled = true;
                                btn.innerText = `${p.name} (Đã chọn)`;
                            }
                        } else if (alreadyClaimedRole && alreadyClaimedRole !== f) {
                            btn.disabled = true;
                            btn.innerText = `${btnLabels[f]} (Đã chọn ${colorLabels[alreadyClaimedRole]})`;
                        } else {
                            btn.disabled = false;
                            btn.innerText = btnLabels[f];
                        }
                    });
                } else {
                    subscribePrivateChatsForRole(currentRoomCode, myRole);
                    if (roomData.phase === "waiting") {
                        cleanupGhostPlayersInCurrentWaitingRoom();
                    }
                    syncTimelineAndUI();
                    updateUnreadBadges();
                    if (isChatOpen) {
                        renderPrivateChatUI();
                    }
                }
            });
        }

        window.joinGame = async (role) => {
            if (isBusyLobbyAction) return;
            isBusyLobbyAction = true;
            await ensureAuth();
            const customName = getPlayerCustomName(role);
            let finalRole = role;

            try {
                await runTransaction(db, async (transaction) => {
                    const snap = await transaction.get(roomRef);
                    if (!snap.exists()) throw new Error("Room gone");
                    const data = snap.data();
                    const now = Date.now();

                    // Kiểm tra xem người chơi này (cùng uid) đã chiếm ghế nào trong phòng chưa
                    const existingRoleForUid = factions.find(
                        f => data.players?.[f]?.joined && data.players?.[f]?.uid && data.players[f].uid === currentUid
                    );

                    if (existingRoleForUid && existingRoleForUid !== role) {
                        throw new Error(`ALREADY_HAS_SEAT:${existingRoleForUid}`);
                    }

                    if (data.players[role].joined && data.players[role].uid !== currentUid) {
                        // Nếu ghế đó là "người ma" đã mất kết nối quá lâu ở phòng chờ thì cho phép thay thế
                        if (!isWaitingPlayerActive(data.players[role], data.createdAt, now)) {
                            data.players[role] = createDefaultPlayerObj(colorLabels[role]);
                        } else {
                            throw new Error("Taken");
                        }
                    }

                    const updates = {
                        updatedAt: now
                    };
                    updates[`players.${role}.joined`] = true;
                    updates[`players.${role}.uid`] = currentUid;
                    updates[`players.${role}.name`] = customName;
                    updates[`players.${role}.hp`] = MAX_HP;
                    updates[`players.${role}.start_hp`] = MAX_HP;
                    updates[`players.${role}.lastSeen`] = now;

                    const joinedCount = factions.filter(f => f === role || data.players[f].joined).length;
                    if (joinedCount === 4 && data.phase === "waiting") {
                        updates.phase = "input";
                        updates.phase_start_time = now;
                    }
                    transaction.update(roomRef, updates);
                });

                myRole = finalRole;
                saveActiveSession(currentRoomCode, myRole, customName);
                layoutFortressesAndBoard();
                adjustViewportScale();
                document.getElementById('setup-screen').style.display = 'none';
                document.getElementById('game-screen').style.display = 'flex';
                subscribePrivateChatsForRole(currentRoomCode, myRole);
            } catch (e) {
                const msg = String(e?.message || "");
                if (msg.startsWith("ALREADY_HAS_SEAT:")) {
                    const seat = msg.split(":")[1];
                    alert(`Bạn đã chọn ${colorLabels[seat]} trong phòng này rồi! Hệ thống sẽ đưa bạn vào lại đúng Thành của mình.`);
                    myRole = seat;
                    saveActiveSession(currentRoomCode, myRole, customName);
                    enterDirectGameScreen(currentRoomCode);
                    return;
                }
                alert("Màu Pháo Đài này vừa có người chọn, vui lòng chọn màu khác!");
            } finally {
                isBusyLobbyAction = false;
            }
        };

        // ================= TÍNH NĂNG NÚT EXIT (BỊ LOẠI 0 HP NGAY LẬP TỨC & DỌN PHÒNG CHỜ TRỐNG) =================
        window.openExitModal = () => {
            document.getElementById('exit-modal').style.display = 'flex';
        };

        window.closeExitModal = () => {
            document.getElementById('exit-modal').style.display = 'none';
        };

        window.confirmExitGame = async () => {
            if (isExitingGame) return;
            isExitingGame = true;
            closeExitModal();
            if (!roomRef || !myRole) {
                isExitingGame = false;
                leaveFinishedGame();
                return;
            }

            const exitingRole = myRole;
            const targetRoomRef = roomRef;

            try {
                await runTransaction(db, async (transaction) => {
                    const snap = await transaction.get(targetRoomRef);
                    if (!snap.exists()) return;
                    const data = snap.data();
                    const now = Date.now();

                    if (data.phase === "waiting") {
                        const players = data.players || {};
                        players[exitingRole] = createDefaultPlayerObj(colorLabels[exitingRole]);

                        // Đồng thời dọn các ghế "ma" mất kết nối
                        factions.forEach(f => {
                            if (f !== exitingRole && players[f]?.joined && !isWaitingPlayerActive(players[f], data.createdAt, now)) {
                                players[f] = createDefaultPlayerObj(colorLabels[f]);
                            }
                        });

                        const remainingActive = factions.filter(f => players[f]?.joined).length;
                        if (remainingActive === 0) {
                            // Phòng chờ không còn ai -> Xoá luôn để không tạo phòng rác!
                            transaction.delete(targetRoomRef);
                        } else {
                            transaction.update(targetRoomRef, {
                                players: players,
                                updatedAt: now
                            });
                        }
                        return;
                    }

                    let players = data.players;
                    let elimSeq = data.eliminated_seq || 0;

                    if (players[exitingRole].hp > 0 || !players[exitingRole].eliminated_order) {
                        players[exitingRole].hp = 0;
                        players[exitingRole].start_hp = 0;
                        players[exitingRole].actions = [];
                        players[exitingRole].ready = true;
                        if (!players[exitingRole].eliminated_order) {
                            elimSeq++;
                            players[exitingRole].eliminated_order = elimSeq;
                            players[exitingRole].eliminated_turn = data.turn;
                            players[exitingRole].eliminated_reason = `Rời trận (Exit) ở Vòng ${data.turn}`;
                        }
                    }

                    // Nếu đang ở giai đoạn Chiến lược (input), loại bỏ mọi lệnh tấn công/phòng thủ của các phe khác nhắm vào phe vừa Exit
                    if (data.phase === "input") {
                        factions.forEach(otherF => {
                            if (otherF !== exitingRole && Array.isArray(players[otherF]?.actions)) {
                                players[otherF].actions = players[otherF].actions.filter(a => a.target !== exitingRole);
                            }
                        });
                    }

                    const aliveNow = factions.filter(f => isPlayerAlive(players[f], "input"));
                    if (aliveNow.length <= 1 && data.phase !== "finished") {
                        transaction.update(targetRoomRef, {
                            players: players,
                            eliminated_seq: elimSeq,
                            peace_streak: 0,
                            phase: "finished",
                            finish_type: "normal",
                            phase_start_time: now,
                            updatedAt: now,
                            rankings: computeFinalRankings(players)
                        });
                        return;
                    }

                    // Nếu đang ở giai đoạn input và tất cả các phe còn sống đều đã CHỐT LƯỢT -> phân giải vòng đấu ngay!
                    const allAliveReady = aliveNow.every(f => players[f].ready);
                    if (data.phase === "input" && allAliveReady) {
                        const resolved = computeRoundResolutionPayload(
                            { ...data, eliminated_seq: elimSeq },
                            players,
                            now
                        );
                        transaction.update(targetRoomRef, resolved);
                    } else {
                        transaction.update(targetRoomRef, {
                            players: players,
                            eliminated_seq: elimSeq,
                            peace_streak: 0,
                            updatedAt: now
                        });
                    }
                });
            } catch (e) {
                console.error("Exit transaction error:", e);
            } finally {
                isExitingGame = false;
            }

            leaveFinishedGame();
        };

        window.leaveFinishedGame = () => {
            if (unsubscribeRoom) {
                unsubscribeRoom();
                unsubscribeRoom = null;
            }
            clearPrivateChatSubscriptions();
            clearActiveSession();
            closeRankingModal();
            closePeaceModal();
            closeDiagramModal();
            clearBattleCanvas();
            isChatOpen = false;
            isBusyLobbyAction = false;
            isSubmittingActions = false;
            isExitingGame = false;
            isStartingWaitingRoom = false;
            lastDiagramRenderSig = "";
            document.getElementById('private-chat-panel').style.display = 'none';
            seenMsgCounts = {};
            myRole = null;
            myActions = [];
            roomData = null;
            roomRef = null;
            currentRoomCode = "";
            lastRenderedTurn = 0;
            lastAnimatedCombatTurn = 0;
            endingAutoShown = false;
            document.getElementById('game-screen').style.display = 'none';
            document.getElementById('setup-screen').style.display = 'none';
            document.getElementById('lobby-screen').style.display = 'block';
            const qBtn = document.getElementById('btn-quick-match');
            if (qBtn) {
                qBtn.disabled = false;
                qBtn.innerText = "⚡ GHÉP PHÒNG NHANH (ONLINE)";
            }
        };

        // ================= ĐỒNG BỘ TIMELINE LIÊN HOÀN KHÔNG ĐỘ TRỄ =================
        function getComputedSubPhase(data, now) {
            if (!data) return "waiting";
            if (data.phase === "waiting" || data.phase === "input" || data.phase === "finished") {
                return data.phase;
            }
            if (data.phase === "round_play") {
                const elapsed = Math.max(0, (now - (data.phase_start_time || now)) / 1000);
                const combatDur = data.combat_duration || 3.2;
                if (elapsed < PREP_DURATION) {
                    return "prep";
                } else if (elapsed < PREP_DURATION + combatDur) {
                    return "combat";
                } else {
                    return "result";
                }
            }
            return data.phase;
        }

        setInterval(() => {
            if (!roomData || !myRole) return;
            syncTimelineAndUI();
        }, 80);

        function syncTimelineAndUI() {
            if (!roomData || !myRole) return;
            const now = Date.now();
            const startTime = roomData.phase_start_time || now;
            const elapsed = Math.max(0, (now - startTime) / 1000);
            const timerBox = document.getElementById('timer-box');

            const subPhase = getComputedSubPhase(roomData, now);

            if (subPhase === "input") {
                timerBox.style.background = 'var(--accent-red)';
                const timeLeft = Math.max(0, Math.ceil(STRATEGY_DURATION - elapsed));
                timerBox.innerText = `CHIẾN LƯỢC: ${timeLeft}s`;

                if (elapsed >= STRATEGY_DURATION && !roomData.players[myRole].ready && !isSubmittingActions && isPlayerAlive(roomData.players[myRole], "input")) {
                    submitActions();
                }
                if (elapsed >= STRATEGY_DURATION + 0.3) {
                    triggerRoundResolutionTransaction(true);
                }
            }
            else if (subPhase === "prep") {
                timerBox.style.background = 'var(--accent-purple)';
                const timeLeft = Math.max(0, Math.ceil(PREP_DURATION - elapsed));
                timerBox.innerText = `CHUẨN BỊ: ${timeLeft}s`;
            }
            else if (subPhase === "combat") {
                timerBox.style.background = 'var(--accent-gold)';
                timerBox.innerText = `💥 ĐANG KHAI HỎA...`;
            }
            else if (subPhase === "result") {
                const combatDur = roomData.combat_duration || 3.2;
                const resultElapsed = elapsed - (PREP_DURATION + combatDur);

                if (roomData.will_finish) {
                    timerBox.style.background = 'var(--accent-green)';
                    timerBox.innerText = `🏆 KẾT THÚC TRẬN`;
                    if (!endingAutoShown && !isAnimatingBattle) {
                        endingAutoShown = true;
                        openEndingModal();
                    }
                    finalizeFinishedRoomOnServer();
                } else {
                    timerBox.style.background = 'var(--accent-blue)';
                    const timeLeft = Math.max(0, Math.ceil(RESULT_DURATION - resultElapsed));
                    timerBox.innerText = `KẾT QUẢ: ${timeLeft}s`;

                    if (resultElapsed >= RESULT_DURATION) {
                        advanceFromResultToNextTurn();
                    }
                }
            }
            else if (subPhase === "finished") {
                timerBox.style.background = 'var(--accent-green)';
                timerBox.innerText = `🏆 KẾT THÚC TRẬN`;
            }

            updateUI(roomData, subPhase);
        }

        function aimTurret(sourceKey, targetKey) {
            const s = getScreenPos(sourceKey);
            const t = getScreenPos(targetKey);
            const deg = Math.atan2(t.y - s.y, t.x - s.x) * 180 / Math.PI;
            const pivot = document.getElementById(`turret-${sourceKey}`);
            if (pivot) pivot.style.transform = `rotate(${deg}deg)`;
        }

        function handleBoardActionClick(source, target, type) {
            if (!myRole || source !== myRole || !roomData || isSubmittingActions) return;
            if (roomData.phase !== "input" || roomData.players[myRole].ready) return;

            // Chống spam click cực nhanh trên cùng 1 nút trên bàn cờ (65ms debounce)
            const clickKey = `${source}_${target}_${type}`;
            const now = Date.now();
            if (lastBoardClickMap[clickKey] && (now - lastBoardClickMap[clickKey] < 65)) return;
            lastBoardClickMap[clickKey] = now;

            // Chặn tuyệt đối nếu bản thân hoặc mục tiêu đã bị loại
            if (!isPlayerAlive(roomData.players[myRole], "input")) return;
            if (!isPlayerAlive(roomData.players[target], "input")) return;

            const existingIndex = myActions.findIndex(a => a.target === target && a.type === type);
            if (existingIndex > -1) {
                myActions.splice(existingIndex, 1);
            } else {
                if (myActions.length >= MAX_ACTIONS_PER_TURN) return;
                myActions.push({ target, type });
                if (type === 'attack') aimTurret(source, target);
            }

            updateActionCounterUI();
            renderPreparationSVG("input");
        }

        function updateActionCounterUI() {
            document.getElementById('action-count').innerText = myActions.length;
            const dots = document.querySelectorAll('#action-dots .dot');
            dots.forEach((d, idx) => {
                d.classList.toggle('active', idx < myActions.length);
            });
            const myCostEl = document.getElementById(`cost-${myRole}`);
            if (myCostEl && (currentLocalSubPhase === "input" || currentLocalSubPhase === "prep")) {
                myCostEl.innerText = myActions.length > 0 ? `-${myActions.length}` : "";
            }
        }

        window.submitActions = async () => {
            if (isSubmittingActions || !myRole || !roomData || !isPlayerAlive(roomData.players[myRole], "input") || roomData.players[myRole].ready) return;
            isSubmittingActions = true;
            const submitBtn = document.getElementById('submit-btn');
            if (submitBtn) {
                submitBtn.disabled = true;
                submitBtn.innerText = "⏳ ĐANG CHỐT...";
            }

            const sanitizedLocal = sanitizePlayerActions(myActions, myRole, roomData.players);
            myActions = sanitizedLocal;
            updateActionCounterUI();
            const submitTimestamp = Date.now();

            try {
                await runTransaction(db, async (transaction) => {
                    const snap = await transaction.get(roomRef);
                    if (!snap.exists()) return;
                    const data = snap.data();
                    if (data.phase !== "input") return;

                    let players = data.players;
                    if (!isPlayerAlive(players[myRole], "input")) return;

                    const validActions = sanitizePlayerActions(sanitizedLocal, myRole, players);
                    players[myRole].actions = validActions;
                    players[myRole].ready = true;
                    players[myRole].client_ts = submitTimestamp;
                    players[myRole].lastSeen = submitTimestamp;

                    const allAliveReady = factions
                        .filter(f => isPlayerAlive(players[f], "input"))
                        .every(f => players[f].ready);

                    if (allAliveReady) {
                        const resolved = computeRoundResolutionPayload(data, players, submitTimestamp);
                        transaction.update(roomRef, resolved);
                    } else {
                        const updates = {
                            updatedAt: submitTimestamp
                        };
                        updates[`players.${myRole}.actions`] = validActions;
                        updates[`players.${myRole}.ready`] = true;
                        updates[`players.${myRole}.client_ts`] = submitTimestamp;
                        updates[`players.${myRole}.lastSeen`] = submitTimestamp;
                        transaction.update(roomRef, updates);
                    }
                });
            } catch (e) {
                console.error("Submit actions error:", e);
            } finally {
                isSubmittingActions = false;
            }
        };

        function setFortressHpUI(role, hpVal) {
            const clamped = Math.max(0, hpVal);
            document.getElementById(`hp-${role}`).innerText = clamped;
            const pct = Math.max(0, Math.min(100, (clamped / MAX_HP) * 100));
            document.getElementById(`hp-bar-${role}`).style.width = `${pct}%`;

            const fortEl = document.getElementById(role);
            if (clamped <= 0) {
                fortEl.classList.add("eliminated");
                fortEl.classList.remove("ready");
                document.getElementById(`status-${role}`).innerText = "BỊ LOẠI";
            } else {
                fortEl.classList.remove("eliminated");
            }
        }

        function spawnFloatingDamage(role, dmgText, color = "#ff2a55") {
            const p = getScreenPos(role);
            const badge = document.createElement('div');
            badge.className = 'floating-dmg';
            badge.style.color = color;
            badge.innerText = dmgText;
            badge.style.left = (p.x - 32) + 'px';
            badge.style.top = (p.y - 38) + 'px';
            document.getElementById('game-board').appendChild(badge);
            setTimeout(() => badge.remove(), 1200);
        }

        function triggerBoardShake() {
            const board = document.getElementById('game-board');
            board.classList.remove('board-shake');
            void board.offsetWidth;
            board.classList.add('board-shake');
        }

        function updateUI(data, subPhase) {
            currentLocalSubPhase = subPhase;
            document.getElementById('turn-badge').innerText = `VÒNG ${data.turn}`;

            if (subPhase === "waiting") {
                document.getElementById('waiting-overlay').style.display = 'flex';
                let joinedCount = factions.filter(f => data.players[f].joined).length;
                document.getElementById('wait-count-text').innerText = `${joinedCount}/4`;

                if (joinedCount === 4 && myRole === factions[0] && !isStartingWaitingRoom) {
                    isStartingWaitingRoom = true;
                    updateDoc(roomRef, {
                        phase: "input",
                        phase_start_time: Date.now(),
                        updatedAt: Date.now()
                    }).catch(() => {}).finally(() => {
                        isStartingWaitingRoom = false;
                    });
                }
            } else {
                document.getElementById('waiting-overlay').style.display = 'none';
            }

            if (subPhase === "input" && data.turn !== lastRenderedTurn) {
                lastRenderedTurn = data.turn;
                myActions = [];
                isAnimatingBattle = false;
                clearBattleCanvas();
                updateActionCounterUI();
            }

            // Nếu đang trong giai đoạn chọn lệnh mà bản thân hoặc mục tiêu bị loại (ví dụ vừa bị loại hoặc ấn Exit)
            // -> lập tức loại bỏ mọi lệnh không hợp lệ khỏi myActions!
            if (subPhase === "input") {
                const cleaned = sanitizePlayerActions(myActions, myRole, data.players);
                if (cleaned.length !== myActions.length) {
                    myActions = cleaned;
                    updateActionCounterUI();
                }
            }

            factions.forEach(f => {
                const p = data.players[f];
                const div = document.getElementById(f);
                div.classList.toggle("is-me", f === myRole);
                document.getElementById(`name-${f}`).innerText = p.name || colorLabels[f];

                if (!isAnimatingBattle && subPhase !== "combat") {
                    const shownHp = (subPhase === "prep" && typeof p.start_hp === 'number') ? p.start_hp : p.hp;
                    visualHp[f] = shownHp;
                    setFortressHpUI(f, shownHp);
                }

                const costEl = document.getElementById(`cost-${f}`);
                if ((subPhase === "input" || subPhase === "prep") && f !== myRole) {
                    costEl.innerText = "";
                }

                const aliveInView = isPlayerAlive(p, subPhase);
                if (aliveInView) {
                    document.getElementById(`status-${f}`).innerText = p.ready ? "ĐÃ CHỐT" : "ĐANG TÍNH";
                    div.classList.toggle("ready", Boolean(p.ready));
                } else {
                    document.getElementById(`status-${f}`).innerText = "BỊ LOẠI";
                    div.classList.remove("ready");
                    div.classList.add("eliminated");
                    if (costEl) costEl.innerText = "";
                }
            });

            document.getElementById('my-role-display').innerText = `BẠN: ${data.players[myRole].name}`;

            const submitBtn = document.getElementById('submit-btn');
            const diagramBtn = document.getElementById('diagram-btn');
            const rankBtn = document.getElementById('rank-btn');
            const phaseHint = document.getElementById('phase-hint');
            const svgLayer = document.getElementById('svg-layer');

            const isEndState = (subPhase === "finished") || (subPhase === "result" && data.will_finish);
            diagramBtn.classList.toggle('highlight', subPhase === "result" || isEndState);
            rankBtn.style.display = isEndState ? 'inline-block' : 'none';

            if (subPhase === "input") {
                svgLayer.style.display = 'block';
                submitBtn.style.display = 'inline-block';
                const meAlive = isPlayerAlive(data.players[myRole], "input");
                if (!meAlive) {
                    phaseHint.innerText = "Bạn đã bị loại (0 HP) — Đang quan sát";
                    submitBtn.disabled = true;
                    submitBtn.innerText = "🚫 ĐÃ BỊ LOẠI";
                } else {
                    phaseHint.innerText = "Chiến lược (60s): Chọn lệnh";
                    const isReadyOrSubmitting = Boolean(data.players[myRole].ready || isSubmittingActions);
                    submitBtn.disabled = isReadyOrSubmitting;
                    submitBtn.innerText = data.players[myRole].ready ? "⏳ ĐÃ CHỐT" : (isSubmittingActions ? "⏳ ĐANG CHỐT..." : "✅ CHỐT LƯỢT");
                }
                renderPreparationSVG("input");
            }
            else if (subPhase === "prep") {
                svgLayer.style.display = 'block';
                submitBtn.style.display = 'inline-block';
                submitBtn.disabled = true;
                phaseHint.innerText = "Chuẩn bị khai hỏa (5s)...";
                renderPreparationSVG("prep");
            }
            else if (subPhase === "combat") {
                svgLayer.style.display = 'none';
                submitBtn.style.display = 'none';
                phaseHint.innerText = "Đang khai hỏa theo thứ tự!";

                if (lastAnimatedCombatTurn !== data.turn) {
                    lastAnimatedCombatTurn = data.turn;
                    playRealBattleSequence(data);
                }
            }
            else if (subPhase === "result") {
                svgLayer.style.display = 'none';
                submitBtn.style.display = 'none';
                phaseHint.innerText = data.will_finish ? "Trận đấu đã kết thúc!" : "Kết quả (10s): Xem sơ đồ";
                if (!isAnimatingBattle) {
                    factions.forEach(f => setFortressHpUI(f, data.players[f].hp));
                }
            }
            else if (subPhase === "finished") {
                svgLayer.style.display = 'none';
                submitBtn.style.display = 'none';
                phaseHint.innerText = "Trận đấu đã kết thúc!";
                if (!isAnimatingBattle) {
                    factions.forEach(f => setFortressHpUI(f, data.players[f].hp));
                    if (!endingAutoShown) {
                        endingAutoShown = true;
                        openEndingModal();
                    }
                }
            }

            if (document.getElementById('diagram-modal').style.display === 'flex') {
                renderResultDiagramSVG();
            }
        }

        function renderPreparationSVG(subPhase) {
            if (!roomData || (subPhase !== "input" && subPhase !== "prep")) return;

            factions.forEach(sKey => {
                factions.forEach(tKey => {
                    if (sKey === tKey) return;
                    const sEl = svgCache.shields[`${sKey}_${tKey}`];
                    const aEl = svgCache.arrows[`${sKey}_${tKey}`];
                    if (!sEl || !aEl) return;
                    const sRect = sEl.querySelector('.visual-elem');
                    const aPoly = aEl.querySelector('.visual-elem');

                    const sourceAlive = isPlayerAlive(roomData.players[sKey], subPhase);
                    const targetAlive = isPlayerAlive(roomData.players[tKey], subPhase);

                    // Nếu 1 trong 2 đầu (phe nguồn hoặc phe đích) đã bị loại -> Vô hiệu hóa hoàn toàn (ẩn & khóa click tuyệt đối)!
                    if (!sourceAlive || !targetAlive) {
                        sEl.classList.add('disabled-elem');
                        aEl.classList.add('disabled-elem');
                        sEl.style.display = "none";
                        aEl.style.display = "none";
                        sEl.style.opacity = "0";
                        aEl.style.opacity = "0";
                        sEl.style.pointerEvents = "none";
                        aEl.style.pointerEvents = "none";
                        sRect.setAttribute('fill', '#0f172a');
                        sRect.setAttribute('stroke', '#334155');
                        aPoly.setAttribute('fill', '#0f172a');
                        aPoly.setAttribute('stroke', '#334155');
                        return;
                    }

                    sEl.classList.remove('disabled-elem');
                    aEl.classList.remove('disabled-elem');
                    sEl.style.display = "";
                    aEl.style.display = "";

                    const isMine = (sKey === myRole);
                    const canClick = isMine && subPhase === "input" && !roomData.players[myRole].ready && sourceAlive && targetAlive;

                    sEl.style.opacity = isMine ? "1" : "0.18";
                    aEl.style.opacity = isMine ? "1" : "0.18";
                    sEl.style.pointerEvents = canClick ? "auto" : "none";
                    aEl.style.pointerEvents = canClick ? "auto" : "none";

                    if (isMine) {
                        const activeList = (subPhase === "prep" && roomData.players[myRole]?.ready)
                            ? (roomData.players[myRole].actions || [])
                            : myActions;
                        const isDef = activeList.some(a => a.target === tKey && a.type === 'defend');
                        const isAtt = activeList.some(a => a.target === tKey && a.type === 'attack');

                        sRect.setAttribute('fill', isDef ? '#0ea5e9' : '#1e293b');
                        sRect.setAttribute('stroke', isDef ? '#e0f2fe' : '#64748b');

                        aPoly.setAttribute('fill', isAtt ? '#ef4444' : '#1e293b');
                        aPoly.setAttribute('stroke', isAtt ? '#ffe4e6' : '#64748b');
                    } else {
                        sRect.setAttribute('fill', '#1e293b');
                        sRect.setAttribute('stroke', '#64748b');
                        aPoly.setAttribute('fill', '#1e293b');
                        aPoly.setAttribute('stroke', '#64748b');
                    }
                });
            });
        }

        // ================= HIỂN THỊ KẾT THÚC TRẬN =================
        function getSubmitTimeMs(p) {
            return p.client_ts || Number.MAX_SAFE_INTEGER;
        }

        function computeFinalRankings(players) {
            const list = factions.map(f => ({
                role: f,
                name: players[f].name || colorLabels[f],
                hp: players[f].hp,
                eliminated_order: players[f].eliminated_order || 0,
                eliminated_turn: players[f].eliminated_turn || 0,
                eliminated_reason: players[f].eliminated_reason || "",
                submit_ms: getSubmitTimeMs(players[f])
            }));

            list.sort((a, b) => {
                const aAlive = a.hp > 0;
                const bAlive = b.hp > 0;
                if (aAlive && !bAlive) return -1;
                if (!aAlive && bAlive) return 1;
                if (aAlive && bAlive) {
                    if (b.hp !== a.hp) return b.hp - a.hp;
                    return a.submit_ms - b.submit_ms;
                }
                if (b.eliminated_order !== a.eliminated_order) {
                    return b.eliminated_order - a.eliminated_order;
                }
                return a.submit_ms - b.submit_ms;
            });

            return list.map((item, idx) => ({
                rank: idx + 1,
                ...item
            }));
        }

        window.openEndingModal = () => {
            if (!roomData) return;
            if (roomData.finish_type === "peace") {
                openPeaceModal();
            } else {
                openRankingModal();
            }
        };

        window.openPeaceModal = () => {
            if (!roomData) return;
            const listEl = document.getElementById('peace-players-list');
            listEl.innerHTML = factions.map(f => {
                const p = roomData.players[f];
                return `
                <div class="peace-player-pill">
                    <span style="color:${factionColors[f]}">${escapeHtml(p.name || colorLabels[f])}</span>
                    <span style="color:#38bdf8">${p.hp} HP</span>
                </div>`;
            }).join("");
            document.getElementById('peace-modal').style.display = 'flex';
        };

        window.closePeaceModal = () => {
            document.getElementById('peace-modal').style.display = 'none';
        };

        window.openRankingModal = () => {
            if (!roomData) return;
            const rankings = (roomData.rankings && roomData.rankings.length === 4)
                ? roomData.rankings
                : computeFinalRankings(roomData.players);

            const winner = rankings[0];
            document.getElementById('winner-banner-name').innerText =
                `${winner.name} (${winner.hp} HP)`;

            const container = document.getElementById('ranking-list-container');
            const medals = ["🥇 HẠNG 1", "🥈 HẠNG 2", "🥉 HẠNG 3", "🏅 HẠNG 4"];

            container.innerHTML = rankings.map((r, i) => {
                const statusDesc = r.hp > 0
                    ? "Trụ vững chiến thắng"
                    : (r.eliminated_reason || `Bị loại ở Vòng ${r.eliminated_turn || "?"}`);
                return `
                <div class="rank-row ${i === 0 ? 'top-1' : ''}">
                    <div class="rank-badge">${medals[i] || `HẠNG ${r.rank}`}</div>
                    <div class="rank-info">
                        <div class="rank-player" style="color:${factionColors[r.role] || '#fff'}">${escapeHtml(r.name)}</div>
                        <div class="rank-reason">${escapeHtml(statusDesc)}</div>
                    </div>
                    <div class="rank-hp">${r.hp} HP</div>
                </div>`;
            }).join("");

            document.getElementById('ranking-modal').style.display = 'flex';
        };

        window.closeRankingModal = () => {
            document.getElementById('ranking-modal').style.display = 'none';
        };

        // ================= MODAL SƠ ĐỒ KẾT QUẢ HÌNH THOI 2 CHIỀU =================
        window.openDiagramModal = () => {
            document.getElementById('diagram-modal').style.display = 'flex';
            renderResultDiagramSVG(true);
        };

        window.closeDiagramModal = () => {
            document.getElementById('diagram-modal').style.display = 'none';
        };

        function renderResultDiagramSVG(forceRender = false) {
            const svg = document.getElementById('result-diagram-svg');
            if (!roomData || !svg) return;

            const showCurrentRoundSnap = (currentLocalSubPhase === "combat" || currentLocalSubPhase === "result" || currentLocalSubPhase === "finished");
            const snap = showCurrentRoundSnap
                ? { turn: roomData.turn, players: roomData.players, combat_events: roomData.combat_events || [] }
                : (roomData.last_result_snapshot || { turn: roomData.turn, players: roomData.players, combat_events: [] });

            // Chỉ vẽ lại SVG khi trạng thái vòng đấu hoặc dữ liệu thay đổi (tránh vẽ lại 12.5 lần/giây gây giật lag)
            const diagramSig = `${myRole}_${currentLocalSubPhase}_${snap.turn}_${roomData.updatedAt || 0}_${Boolean(roomData.last_result_snapshot)}`;
            if (!forceRender && diagramSig === lastDiagramRenderSig) return;
            lastDiagramRenderSig = diagramSig;

            const titleEl = document.getElementById('diagram-modal-title');
            if (!showCurrentRoundSnap && !roomData.last_result_snapshot) {
                titleEl.innerText = `SƠ ĐỒ HIỆN TẠI (CHƯA KHAI HỎA VÒNG 1)`;
            } else {
                titleEl.innerText = `SƠ ĐỒ KẾT QUẢ VÒNG ${snap.turn}`;
            }

            let html = "";
            const showMoves = showCurrentRoundSnap || Boolean(roomData.last_result_snapshot);
            const events = snap.combat_events || [];

            factions.forEach(sKey => {
                factions.forEach(tKey => {
                    if (sKey === tKey) return;

                    const sStartHp = typeof snap.players[sKey]?.start_hp === 'number' ? snap.players[sKey].start_hp : (snap.players[sKey]?.hp || 0);
                    const tStartHp = typeof snap.players[tKey]?.start_hp === 'number' ? snap.players[tKey].start_hp : (snap.players[tKey]?.hp || 0);
                    // Nếu 1 trong 2 phe đã bị loại từ vòng trước (start_hp <= 0), ẩn mờ đường nối đó trên sơ đồ
                    const pairInactive = (sStartHp <= 0 || tStartHp <= 0);

                    const s = getDiagramPos(sKey);
                    const t = getDiagramPos(tKey);
                    const dx = t.x - s.x;
                    const dy = t.y - s.y;
                    const dist = Math.hypot(dx, dy);
                    const nx = dx / dist;
                    const ny = dy / dist;
                    const px = -ny;
                    const py = nx;

                    const isCross = dist > 350;
                    const shieldDist = isCross ? 96 : 88;
                    const shieldHalfW = isCross ? 26 : 30;
                    const shieldThick = 11;

                    const scx = s.x + nx * shieldDist;
                    const scy = s.y + ny * shieldDist;
                    const angleDeg = Math.atan2(dy, dx) * 180 / Math.PI;

                    const sActions = (showMoves && !pairInactive) ? (snap.players[sKey]?.actions || []) : [];
                    const isDef = sActions.some(a => a.target === tKey && a.type === 'defend');
                    const isAtt = sActions.some(a => a.target === tKey && a.type === 'attack');

                    const shotEvent = events.find(e => e.type === 'shot' && e.attacker === sKey && e.target === tKey);

                    const shieldFill = isDef ? "#111827" : "#ffffff";
                    const pairOpacity = pairInactive ? "0.12" : "1";
                    html += `
                    <g transform="translate(${scx}, ${scy}) rotate(${angleDeg})" opacity="${pairOpacity}">
                        <rect x="${-shieldThick/2}" y="${-shieldHalfW}" width="${shieldThick}" height="${shieldHalfW * 2}"
                              fill="${shieldFill}" stroke="#111827" stroke-width="2.8" rx="2" />
                    </g>`;

                    const laneOffset = isCross ? 9 : 11;
                    const margin = shieldDist + 18;
                    const x1 = s.x + nx * margin + px * laneOffset;
                    const y1 = s.y + ny * margin + py * laneOffset;
                    const x2 = t.x - nx * margin + px * laneOffset;
                    const y2 = t.y - ny * margin + py * laneOffset;

                    const arrowLen = Math.hypot(x2 - x1, y2 - y1);
                    const arrowAngle = Math.atan2(y2 - y1, x2 - x1) * 180 / Math.PI;
                    const headLen = 16;
                    const shaftEnd = arrowLen - headLen;
                    const points = `0,-3.8 ${shaftEnd},-3.8 ${shaftEnd},-9.5 ${arrowLen},0 ${shaftEnd},9.5 ${shaftEnd},3.8 0,3.8`;

                    let arrowFill = "#ffffff";
                    if (isAtt) {
                        if (!shotEvent) {
                            arrowFill = "#94a3b8";
                        } else if (shotEvent.blocked) {
                            arrowFill = "#111827";
                        } else {
                            arrowFill = "#ef4444";
                        }
                    }

                    html += `
                    <g transform="translate(${x1}, ${y1}) rotate(${arrowAngle})" opacity="${pairOpacity}">
                        <polygon points="${points}" fill="${arrowFill}" stroke="#111827" stroke-width="2.2" stroke-linejoin="round" />
                    </g>`;
                });
            });

            factions.forEach(f => {
                const p = snap.players[f];
                const c = getDiagramPos(f);
                const startHp = typeof p.start_hp === 'number' ? p.start_hp : p.hp;
                const diff = showMoves ? (p.hp - startHp) : 0;
                const diffStr = diff < 0 ? `${diff}` : (diff === 0 ? "0" : `+${diff}`);
                const borderCol = (f === 'thuc') ? '#334155' : factionColors[f];
                const isMeLabel = (f === myRole) ? " (BẠN)" : "";
                const displayHp = showMoves ? p.hp : startHp;

                html += `
                <g transform="translate(${c.x}, ${c.y})">
                    <rect x="-64" y="-56" width="128" height="112" rx="14" fill="#ffffff" stroke="#111827" stroke-width="4" />
                    <rect x="-58" y="-50" width="116" height="100" rx="10" fill="none" stroke="${borderCol}" stroke-width="4" />
                    <text x="0" y="-24" text-anchor="middle" font-family="Chakra Petch" font-weight="800" font-size="12" fill="#0f172a">
                        ${escapeHtml((p.name || colorLabels[f]) + isMeLabel)}
                    </text>
                    <text x="0" y="10" text-anchor="middle" font-family="Chakra Petch" font-weight="800" font-size="30" fill="#111827">
                        ${displayHp} HP
                    </text>
                    <text x="0" y="36" text-anchor="middle" font-family="Chakra Petch" font-weight="800" font-size="16" fill="#ef4444">
                        (${diffStr} HP)
                    </text>
                </g>`;
            });

            svg.innerHTML = html;
        }

        // ================= TÍNH TOÁN KỊCH BẢN VÒNG ĐẤU & KIỂM TRA CÁI KẾT HÒA BÌNH ẨN =================
        function computeRoundResolutionPayload(data, players, now) {
            let elimSeq = data.eliminated_seq || 0;
            let combatEvents = [];

            // Xác định chính xác các phe còn sống khi bắt đầu vòng đấu này
            const wasAliveAtStart = {};
            factions.forEach((f, idx) => {
                const p = players[f];
                const alive = Boolean(p && p.hp > 0 && !(p.eliminated_order > 0));
                wasAliveAtStart[f] = alive;

                if (!alive) {
                    p.hp = 0;
                    p.start_hp = 0;
                    p.actions = [];
                    p.ready = true;
                    p.client_ts = Number.MAX_SAFE_INTEGER;
                } else {
                    p.start_hp = p.hp;
                    if (!p.ready) {
                        p.ready = true;
                        p.actions = p.actions || [];
                        p.client_ts = now + 5000 + idx * 10;
                    }
                }
            });

            // Khử trùng lặp, giới hạn tối đa 3 lệnh, và loại bỏ mọi lệnh nhắm vào phe đã bị loại
            factions.forEach(f => {
                if (!wasAliveAtStart[f]) {
                    players[f].actions = [];
                    return;
                }
                players[f].actions = sanitizePlayerActions(players[f].actions, f, players, wasAliveAtStart);
            });

            const aliveStartOrder = factions
                .filter(f => wasAliveAtStart[f])
                .sort((a, b) => getSubmitTimeMs(players[a]) - getSubmitTimeMs(players[b]));

            // Bước 1: Trừ HP chi phí chiến lược (-1 HP mỗi lệnh, tối đa 3 lệnh)
            aliveStartOrder.forEach(f => {
                const cost = (players[f].actions || []).length;
                if (cost > 0) {
                    players[f].hp = Math.max(0, players[f].hp - cost);
                    if (players[f].hp === 0 && !players[f].eliminated_order) {
                        elimSeq++;
                        players[f].eliminated_order = elimSeq;
                        players[f].eliminated_turn = data.turn;
                        players[f].eliminated_reason = `Bị loại do cạn HP chiến lược (Chốt #${aliveStartOrder.indexOf(f) + 1} - Vòng ${data.turn})`;
                        combatEvents.push({
                            type: 'strategy_eliminated',
                            role: f,
                            eliminated_order: elimSeq
                        });
                    }
                }
            });

            // Bước 2: Lần lượt từng phe khai hỏa theo thứ tự chốt lượt
            aliveStartOrder.forEach(attacker => {
                // Nếu phe tấn công đã bị loại (do cạn HP chiến lược hoặc bị bắn hạ ở lượt trước) -> Vô hiệu hóa đòn bắn!
                if (players[attacker].hp <= 0 || players[attacker].eliminated_order > 0) {
                    const canceledCount = (players[attacker].actions || []).filter(a => a.type === 'attack').length;
                    if (canceledCount > 0) {
                        combatEvents.push({
                            type: 'canceled_attacks',
                            attacker: attacker
                        });
                    }
                    return;
                }

                const attackActions = (players[attacker].actions || [])
                    .filter(a => a.type === 'attack')
                    .sort((a, b) => getSubmitTimeMs(players[b.target]) - getSubmitTimeMs(players[a.target]));

                attackActions.forEach(act => {
                    const target = act.target;

                    // Nếu mục tiêu đã bị loại ở lượt trước đó (do cạn HP chiến lược hoặc vừa bị phe khác tiêu diệt)
                    // -> Vô hiệu hóa luôn phát bắn và khiên thủ của mục tiêu đó!
                    if (!players[target] || players[target].hp <= 0 || players[target].eliminated_order > 0) {
                        return;
                    }

                    // Mục tiêu đang còn sống mới có thể dựng tường chắn (defend)
                    const isDefended = (players[target].actions || []).some(
                        tAct => tAct.type === 'defend' && tAct.target === attacker
                    );

                    let eliminatedTarget = false;
                    if (!isDefended && players[target].hp > 0) {
                        players[target].hp = Math.max(0, players[target].hp - 3);
                        if (players[target].hp === 0 && !players[target].eliminated_order) {
                            elimSeq++;
                            players[target].eliminated_order = elimSeq;
                            players[target].eliminated_turn = data.turn;
                            players[target].eliminated_reason = `Bị ${players[attacker].name} loại khỏi trận (Vòng ${data.turn})`;
                            eliminatedTarget = true;
                        }
                    }

                    combatEvents.push({
                        type: 'shot',
                        attacker,
                        target,
                        blocked: isDefended,
                        eliminated: eliminatedTarget,
                        newTargetHp: players[target].hp
                    });
                });
            });

            const noOneLostHpThisRound = factions.every(f => players[f].hp === players[f].start_hp);
            const newPeaceStreak = noOneLostHpThisRound ? ((data.peace_streak || 0) + 1) : 0;

            const aliveNow = factions.filter(f => players[f].hp > 0 && !(players[f].eliminated_order > 0));
            const isPeaceEnding = (newPeaceStreak >= 3);
            const isNormalEnding = (aliveNow.length <= 1);
            const willFinish = isPeaceEnding || isNormalEnding;
            const finishType = isPeaceEnding ? "peace" : "normal";

            const totalShots = combatEvents.filter(e => e.type === 'shot').length;
            const combatDuration = Math.max(1.8, 1.0 + totalShots * 0.85);
            const finalRankings = willFinish ? computeFinalRankings(players) : (data.rankings || []);
            const resolveTime = Date.now();

            return {
                players: players,
                eliminated_seq: elimSeq,
                peace_streak: newPeaceStreak,
                will_finish: willFinish,
                finish_type: finishType,
                combat_events: combatEvents,
                rankings: finalRankings,
                phase: "round_play",
                phase_start_time: resolveTime,
                updatedAt: resolveTime,
                combat_duration: combatDuration,
                last_result_snapshot: {
                    turn: data.turn,
                    players: JSON.parse(JSON.stringify(players)),
                    combat_events: combatEvents
                }
            };
        }

        async function triggerRoundResolutionTransaction(isTimeoutForce = false) {
            if (isAdvancingPhase || !roomRef) return;
            isAdvancingPhase = true;
            try {
                await runTransaction(db, async (transaction) => {
                    const snap = await transaction.get(roomRef);
                    if (!snap.exists()) return;
                    const data = snap.data();
                    if (data.phase !== "input") return;

                    const now = Date.now();
                    const elapsed = (now - (data.phase_start_time || now)) / 1000;

                    let allReady = true;
                    factions.forEach(f => {
                        if (isPlayerAlive(data.players[f], "input") && !data.players[f].ready) {
                            allReady = false;
                        }
                    });

                    if (!allReady && !(isTimeoutForce && elapsed >= STRATEGY_DURATION - 0.3)) return;

                    let players = data.players;
                    if (myRole && isPlayerAlive(players[myRole], "input") && !players[myRole].ready) {
                        players[myRole].actions = sanitizePlayerActions(myActions, myRole, players);
                        players[myRole].ready = true;
                        players[myRole].client_ts = now;
                    }

                    const resolvedPayload = computeRoundResolutionPayload(data, players, now);
                    transaction.update(roomRef, resolvedPayload);
                });
            } catch (e) {
            } finally {
                isAdvancingPhase = false;
            }
        }

        async function finalizeFinishedRoomOnServer() {
            if (isAdvancingPhase || !roomRef || !roomData || roomData.phase === "finished") return;
            isAdvancingPhase = true;
            try {
                await updateDoc(roomRef, {
                    phase: "finished",
                    updatedAt: Date.now()
                });
            } catch (e) {
            } finally {
                isAdvancingPhase = false;
            }
        }

        async function advanceFromResultToNextTurn() {
            if (isAdvancingPhase || !roomRef) return;
            isAdvancingPhase = true;
            try {
                await runTransaction(db, async (transaction) => {
                    const snap = await transaction.get(roomRef);
                    if (!snap.exists()) return;
                    const fresh = snap.data();
                    if (fresh.phase !== "round_play") return;

                    const now = Date.now();
                    if (fresh.will_finish) {
                        transaction.update(roomRef, {
                            phase: "finished",
                            updatedAt: now
                        });
                        return;
                    }

                    let players = fresh.players;
                    factions.forEach(f => {
                        const eliminated = isPlayerEliminated(players[f], "result");
                        if (eliminated) {
                            // Phe đã bị loại phải bị vô hiệu hóa hoàn toàn ở vòng kế tiếp!
                            players[f].hp = 0;
                            players[f].start_hp = 0;
                            players[f].actions = [];
                            players[f].ready = true;
                            players[f].client_ts = Number.MAX_SAFE_INTEGER;
                        } else {
                            players[f].ready = false;
                            players[f].actions = [];
                            players[f].client_ts = 0;
                            players[f].start_hp = players[f].hp;
                        }
                    });

                    transaction.update(roomRef, {
                        phase: "input",
                        players: players,
                        turn: fresh.turn + 1,
                        phase_start_time: now,
                        updatedAt: now
                    });
                });
            } catch (e) {
            } finally {
                isAdvancingPhase = false;
            }
        }

        // ================= DIỄN HOẠT TRẬN ĐÁNH PHÁO ĐÀI HÌNH THOI (CANVAS 2.5D) =================
        const canvas = document.getElementById('battle-canvas');
        const ctx = canvas.getContext('2d');
        let activeWalls = [];
        let activeShells = [];
        let activeParticles = [];
        let animFrameId = null;

        function clearBattleCanvas() {
            battleSequenceToken++;
            activeShells.forEach(sh => {
                if (typeof sh.onAbort === 'function') sh.onAbort();
            });
            activeWalls = [];
            activeShells = [];
            activeParticles = [];
            if (animFrameId) {
                cancelAnimationFrame(animFrameId);
                animFrameId = null;
            }
            ctx.clearRect(0, 0, canvas.width, canvas.height);
        }

        function spawnExplosion(x, y, color, count = 20) {
            for (let i = 0; i < count; i++) {
                const angle = Math.random() * Math.PI * 2;
                const speed = 1.5 + Math.random() * 5.2;
                activeParticles.push({
                    x, y,
                    vx: Math.cos(angle) * speed,
                    vy: Math.sin(angle) * speed,
                    radius: 2.5 + Math.random() * 3.5,
                    color,
                    alpha: 1,
                    decay: 0.028 + Math.random() * 0.02
                });
            }
        }

        function renderBattleLoop() {
            ctx.clearRect(0, 0, canvas.width, canvas.height);

            activeWalls.forEach(w => {
                if (w.progress < 1) w.progress = Math.min(1, w.progress + 0.1);
                const g = w.geom;
                const curHalfX = (g.x1 - g.cx) * w.progress;
                const curHalfY = (g.y1 - g.cy) * w.progress;

                const x1 = g.cx + curHalfX;
                const y1 = g.cy + curHalfY;
                const x2 = g.cx - curHalfX;
                const y2 = g.cy - curHalfY;

                ctx.beginPath();
                ctx.moveTo(x1, y1 + 7);
                ctx.lineTo(x2, y2 + 7);
                ctx.strokeStyle = "#060911";
                ctx.lineWidth = 14;
                ctx.lineCap = "round";
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = w.hitFlash > 0 ? "#ffffff" : "#0ea5e9";
                ctx.lineWidth = 12;
                ctx.lineCap = "round";
                ctx.stroke();

                ctx.beginPath();
                ctx.moveTo(x1, y1);
                ctx.lineTo(x2, y2);
                ctx.strokeStyle = "#e0f2fe";
                ctx.lineWidth = 4;
                ctx.stroke();

                if (w.hitFlash > 0) w.hitFlash--;
            });

            for (let i = activeShells.length - 1; i >= 0; i--) {
                const sh = activeShells[i];
                sh.progress += sh.speed;

                const curX = sh.startX + (sh.endX - sh.startX) * sh.progress;
                const curY = sh.startY + (sh.endY - sh.startY) * sh.progress;

                activeParticles.push({
                    x: curX, y: curY,
                    vx: (Math.random() - 0.5) * 0.8,
                    vy: (Math.random() - 0.5) * 0.8,
                    radius: 3.2,
                    color: sh.color,
                    alpha: 0.65,
                    decay: 0.055
                });

                ctx.beginPath();
                ctx.arc(curX, curY, 7, 0, Math.PI * 2);
                ctx.fillStyle = "#ffffff";
                ctx.fill();
                ctx.lineWidth = 3;
                ctx.strokeStyle = sh.color;
                ctx.stroke();

                if (sh.progress >= 1) {
                    if (sh.onImpact) sh.onImpact(sh.endX, sh.endY);
                    activeShells.splice(i, 1);
                }
            }

            for (let i = activeParticles.length - 1; i >= 0; i--) {
                const pt = activeParticles[i];
                pt.x += pt.vx;
                pt.y += pt.vy;
                pt.alpha -= pt.decay;

                if (pt.alpha <= 0) {
                    activeParticles.splice(i, 1);
                    continue;
                }

                ctx.globalAlpha = pt.alpha;
                ctx.beginPath();
                ctx.arc(pt.x, pt.y, pt.radius, 0, Math.PI * 2);
                ctx.fillStyle = pt.color;
                ctx.fill();
            }
            ctx.globalAlpha = 1;

            if (isAnimatingBattle || activeShells.length > 0 || activeParticles.length > 0) {
                animFrameId = requestAnimationFrame(renderBattleLoop);
            }
        }

        const sleep = (ms) => new Promise(res => setTimeout(res, ms));

        async function playRealBattleSequence(data) {
            clearBattleCanvas();
            const myToken = battleSequenceToken;
            isAnimatingBattle = true;

            factions.forEach(f => {
                const p = data.players[f];
                visualHp[f] = (typeof p.start_hp === 'number') ? p.start_hp : p.hp;
                setFortressHpUI(f, visualHp[f]);
            });

            animFrameId = requestAnimationFrame(renderBattleLoop);

            factions.forEach(f => {
                const p = data.players[f];
                const actions = (visualHp[f] > 0 && Array.isArray(p.actions)) ? p.actions.slice(0, MAX_ACTIONS_PER_TURN) : [];
                const cost = actions.length;
                document.getElementById(`cost-${f}`).innerText = cost > 0 ? `-${cost} HP` : "";

                if (visualHp[f] > 0 && cost > 0) {
                    visualHp[f] = Math.max(0, visualHp[f] - cost);
                    setFortressHpUI(f, visualHp[f]);
                    spawnFloatingDamage(f, visualHp[f] === 0 ? `BỊ LOẠI (-${cost} HP)` : `-${cost} HP`, "#f59e0b");
                }

                if (visualHp[f] > 0) {
                    actions.forEach(act => {
                        if (act.type === 'defend' && visualHp[act.target] > 0) {
                            const geom = shieldGeometry[`${f}_${act.target}`];
                            if (geom) {
                                activeWalls.push({
                                    owner: f,
                                    attacker: act.target,
                                    geom,
                                    progress: 0,
                                    hitFlash: 0
                                });
                            }
                        }
                    });
                }
            });

            await sleep(500);
            if (myToken !== battleSequenceToken) return;

            const events = data.combat_events || [];
            for (const ev of events) {
                if (myToken !== battleSequenceToken) return;

                if (ev.type === 'canceled_attacks') {
                    spawnFloatingDamage(ev.attacker, "VÔ HIỆU ĐÒN (ĐÃ BỊ LOẠI)", "#94a3b8");
                    await sleep(220);
                    continue;
                }

                if (ev.type === 'shot') {
                    const attacker = ev.attacker;
                    const target = ev.target;
                    if (visualHp[attacker] <= 0 || visualHp[target] <= 0) continue;

                    aimTurret(attacker, target);
                    await sleep(110);
                    if (myToken !== battleSequenceToken) return;

                    const barrel = document.getElementById(`barrel-${attacker}`);
                    if (barrel) {
                        barrel.classList.add('recoil');
                        setTimeout(() => barrel.classList.remove('recoil'), 110);
                    }

                    const sPos = getScreenPos(attacker);
                    const tPos = getScreenPos(target);
                    const wall = activeWalls.find(w => w.owner === target && w.attacker === attacker);

                    const endX = (ev.blocked && wall) ? wall.geom.cx : tPos.x;
                    const endY = (ev.blocked && wall) ? wall.geom.cy : tPos.y;

                    const dx = tPos.x - sPos.x;
                    const dy = tPos.y - sPos.y;
                    const dist = Math.hypot(dx, dy);
                    const muzzleX = sPos.x + (dx / dist) * 38;
                    const muzzleY = sPos.y + (dy / dist) * 38;
                    spawnExplosion(muzzleX, muzzleY, factionColors[attacker], 10);

                    await new Promise(resolveShot => {
                        let settled = false;
                        const finishShot = () => {
                            if (settled) return;
                            settled = true;
                            resolveShot();
                        };
                        // Timeout dự phòng nếu tab bị ẩn ở nền khiến requestAnimationFrame bị trình duyệt tạm dừng
                        const fallbackTimer = setTimeout(() => {
                            if (settled || myToken !== battleSequenceToken) return finishShot();
                            if (!ev.blocked) {
                                visualHp[target] = ev.newTargetHp;
                                setFortressHpUI(target, visualHp[target]);
                                if (ev.eliminated || visualHp[target] <= 0) {
                                    activeWalls = activeWalls.filter(w => w.owner !== target && w.attacker !== target);
                                }
                            }
                            finishShot();
                        }, 650);

                        activeShells.push({
                            startX: muzzleX,
                            startY: muzzleY,
                            endX,
                            endY,
                            progress: 0,
                            speed: 0.062,
                            color: factionColors[attacker],
                            onAbort: () => {
                                clearTimeout(fallbackTimer);
                                finishShot();
                            },
                            onImpact: (ix, iy) => {
                                clearTimeout(fallbackTimer);
                                if (settled) return;
                                if (ev.blocked) {
                                    if (wall) wall.hitFlash = 8;
                                    spawnExplosion(ix, iy, "#38bdf8", 24);
                                    spawnFloatingDamage(target, "CHẶN ĐỨNG!", "#38bdf8");
                                } else {
                                    spawnExplosion(ix, iy, "#ef4444", 32);
                                    triggerBoardShake();
                                    visualHp[target] = ev.newTargetHp;
                                    setFortressHpUI(target, visualHp[target]);
                                    spawnFloatingDamage(target, ev.eliminated ? "💥 BỊ LOẠI (-3 HP)" : "-3 HP", "#ff2a55");
                                    // Khi một phe vừa bị bắn hạ (0 HP), lập tức xóa bỏ mọi tường chắn của phe đó trên bàn cờ!
                                    if (ev.eliminated || visualHp[target] <= 0) {
                                        activeWalls = activeWalls.filter(w => w.owner !== target && w.attacker !== target);
                                    }
                                }
                                finishShot();
                            }
                        });
                    });

                    await sleep(190);
                }
            }

            if (myToken !== battleSequenceToken) return;
            factions.forEach(f => setFortressHpUI(f, data.players[f].hp));
            isAnimatingBattle = false;

            if (roomData && roomData.will_finish && !endingAutoShown) {
                endingAutoShown = true;
                openEndingModal();
            }
        }
