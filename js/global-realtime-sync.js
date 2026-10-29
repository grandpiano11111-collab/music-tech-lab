/**
 * ==========================================================================
 *  MUSIC TECH LAB - Global Realtime Request Sync Engine
 *  File: js/global-realtime-sync.js
 * ==========================================================================
 */

(function() {
  'use strict';

  console.log('%c🌐 [GLOBAL-REALTIME-SYNC] 世界全端末リアルタイム数値連動エンジン起動中...', 'color: #06b6d4; font-weight: bold;');

  const BROKER_URLS = [
    'wss://broker.emqx.io:8084/mqtt',
    'wss://broker.hivemq.com:8884/mqtt'
  ];

  const TOPIC_VOTES = 'music_tech_lab/realtime_votes/v1';
  const TOPIC_STATE = 'music_tech_lab/latest_state/v1';
  const TOPIC_PEER = 'music_tech_lab/peer_sync/v1';

  function getDeviceId() {
    try {
      if (window.VoteLockShield && window.VoteLockShield.deviceId) {
        return window.VoteLockShield.deviceId;
      }
      const saved = localStorage.getItem('piano_cinema_device_uuid_v2');
      if (saved) return saved;
    } catch (e) {}
    return 'dev_' + Math.random().toString(36).substring(2, 10);
  }

  const GlobalRealtimeSync = {
    client: null,
    deviceId: getDeviceId(),
    currentBrokerIdx: 0,
    isConnected: false,
    reconnectTimer: null,

    getStorageKey(section) {
      if (section === 2) return 'piano_cinema_request2_votes';
      if (section === 3) return 'piano_cinema_request3_votes';
      return 'piano_cinema_request_votes';
    },

    getVotes(section) {
      const key = this.getStorageKey(section);
      try {
        const raw = localStorage.getItem(key);
        if (raw) {
          const parsed = JSON.parse(raw);
          if (Array.isArray(parsed) && parsed.length >= 12) {
            return parsed.map(v => Number(v) || 0);
          }
        }
      } catch (e) {}
      return [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0];
    },

    saveVotes(section, votes) {
      const key = this.getStorageKey(section);
      try {
        localStorage.setItem(key, JSON.stringify(votes));
      } catch (e) {}
    },

    mergeVotes(localVotes, remoteVotes) {
      if (!Array.isArray(remoteVotes)) return localVotes;
      const result = [];
      for (let i = 0; i < 12; i++) {
        const l = Number(localVotes[i]) || 0;
        const r = Number(remoteVotes[i]) || 0;
        result.push(Math.max(l, r));
      }
      return result;
    },

    init() {
      this.connect();
      this.hookAppVotes();
      this.hookAdminResets();
    },

    connect() {
      if (typeof window.mqtt === 'undefined') {
        console.warn('[GlobalRealtimeSync] MQTT library not yet loaded. Retrying in 500ms...');
        setTimeout(() => this.connect(), 500);
        return;
      }

      const brokerUrl = BROKER_URLS[this.currentBrokerIdx];
      const clientId = 'mtl_' + this.deviceId.replace(/[^a-zA-Z0-9]/g, '_').substring(0, 20) + '_' + Math.random().toString(16).substring(2, 6);

      try {
        this.client = window.mqtt.connect(brokerUrl, {
          clientId: clientId,
          clean: true,
          connectTimeout: 7000,
          reconnectPeriod: 4000,
          keepalive: 30
        });

        this.client.on('connect', () => {
          this.isConnected = true;
          console.log(`%c🌐 [GLOBAL-REALTIME-SYNC] 世界リアルタイムサーバーに接続完了 (${brokerUrl})`, 'color: #10b981; font-weight: bold;');

          this.client.subscribe([TOPIC_VOTES, TOPIC_STATE, TOPIC_PEER], { qos: 1 }, (err) => {
            if (!err) {
              this.requestInitialSync();
            }
          });
        });

        this.client.on('message', (topic, payload) => {
          this.handleIncomingMessage(topic, payload);
        });

        this.client.on('error', (err) => {
          console.warn('[GlobalRealtimeSync] Connection error:', err.message || err);
          this.switchBroker();
        });

        this.client.on('close', () => {
          this.isConnected = false;
        });

      } catch (err) {
        console.warn('[GlobalRealtimeSync] Connect error:', err);
        this.switchBroker();
      }
    },

    switchBroker() {
      if (this.reconnectTimer) return;
      this.reconnectTimer = setTimeout(() => {
        this.reconnectTimer = null;
        this.currentBrokerIdx = (this.currentBrokerIdx + 1) % BROKER_URLS.length;
        if (this.client) {
          try { this.client.end(true); } catch (e) {}
        }
        console.log(`[GlobalRealtimeSync] 次のサーバーへフェイルオーバー切り替え: ${BROKER_URLS[this.currentBrokerIdx]}`);
        this.connect();
      }, 3000);
    },

    requestInitialSync() {
      if (!this.client || !this.isConnected) return;
      const payload = JSON.stringify({
        type: 'REQUEST_LATEST',
        deviceId: this.deviceId,
        timestamp: Date.now()
      });
      this.client.publish(TOPIC_PEER, payload, { qos: 0 });
    },

    handleIncomingMessage(topic, payload) {
      try {
        const msgStr = payload.toString();
        const data = JSON.parse(msgStr);
        if (!data || typeof data !== 'object') return;

        if (topic === TOPIC_VOTES) {
          this.onVoteEvent(data);
        } else if (topic === TOPIC_STATE) {
          this.onStateEvent(data);
        } else if (topic === TOPIC_PEER) {
          this.onPeerEvent(data);
        }
      } catch (err) {
        console.warn('[GlobalRealtimeSync] Error parsing incoming message:', err);
      }
    },

    onVoteEvent(data) {
      if (data.deviceId === this.deviceId) return;

      const sec = Number(data.section) || 1;
      const slot = Number(data.slotIndex) || 1;
      const count = Number(data.count) || 0;

      const currentVotes = this.getVotes(sec);
      const prevVal = currentVotes[slot - 1] || 0;

      if (Array.isArray(data.votes)) {
        const merged = this.mergeVotes(currentVotes, data.votes);
        this.saveVotes(sec, merged);
      } else {
        currentVotes[slot - 1] = Math.max(prevVal, count);
        this.saveVotes(sec, currentVotes);
      }

      this.triggerUIUpdate(sec, slot);
      console.log(`%c⚡ [GLOBAL-REALTIME-SYNC] 世界の誰かが投票！第${sec}弾 [曲${slot}] 数値跳ね上がり検知 -> ${count}`, 'color: #f59e0b; font-weight: bold;');
    },

    onStateEvent(data) {
      let updated = false;
      [1, 2, 3].forEach(sec => {
        const remoteVotes = data[`req${sec}`];
        if (Array.isArray(remoteVotes)) {
          const current = this.getVotes(sec);
          const merged = this.mergeVotes(current, remoteVotes);
          if (JSON.stringify(current) !== JSON.stringify(merged)) {
            this.saveVotes(sec, merged);
            updated = true;
          }
        }
      });

      if (updated) {
        this.triggerAllUIUpdates();
        console.log('%c⚡ [GLOBAL-REALTIME-SYNC] 最新の世界合計数値を全スロットへ一括同期完了', 'color: #10b981;');
      }
    },

    onPeerEvent(data) {
      if (data.type === 'REQUEST_LATEST' && data.deviceId !== this.deviceId) {
        if (!this.client || !this.isConnected) return;
        const v1 = this.getVotes(1);
        const v2 = this.getVotes(2);
        const v3 = this.getVotes(3);
        const hasVotes = v1.some(v => v > 0) || v2.some(v => v > 0) || v3.some(v => v > 0);
        if (hasVotes) {
          const reply = JSON.stringify({
            type: 'RESPONSE_LATEST',
            req1: v1,
            req2: v2,
            req3: v3,
            timestamp: Date.now()
          });
          this.client.publish(TOPIC_PEER, reply, { qos: 0 });
        }
      } else if (data.type === 'RESPONSE_LATEST' && data.deviceId !== this.deviceId) {
        this.onStateEvent(data);
      } else if (data.type === 'RESET_EVENT' && data.deviceId !== this.deviceId) {
        const sec = Number(data.section) || 1;
        this.saveVotes(sec, [0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0]);
        this.triggerAllUIUpdates(sec);
      }
    },

    broadcastVote(section, slotIndex, currentCount, allVotes) {
      if (!this.client || !this.isConnected) {
        this.connect();
      }

      const voteMsg = JSON.stringify({
        type: 'VOTE_EVENT',
        section: section,
        slotIndex: slotIndex,
        count: currentCount,
        votes: allVotes,
        deviceId: this.deviceId,
        timestamp: Date.now()
      });

      if (this.client && this.isConnected) {
        this.client.publish(TOPIC_VOTES, voteMsg, { qos: 1 });

        const stateMsg = JSON.stringify({
          type: 'LATEST_STATE',
          req1: this.getVotes(1),
          req2: this.getVotes(2),
          req3: this.getVotes(3),
          timestamp: Date.now()
        });
        this.client.publish(TOPIC_STATE, stateMsg, { qos: 1, retain: true });
        console.log(`%c🌐 [GLOBAL-REALTIME-SYNC] 投票イベントを世界中の全端末へ即時ブロードキャスト完了！(第${section}弾 曲${slotIndex} = ${currentCount})`, 'color: #3b82f6; font-weight: bold;');
      }
    },

    broadcastReset(section) {
      if (!this.client || !this.isConnected) return;
      const resetMsg = JSON.stringify({
        type: 'RESET_EVENT',
        section: section,
        deviceId: this.deviceId,
        timestamp: Date.now()
      });
      this.client.publish(TOPIC_PEER, resetMsg, { qos: 1 });

      const stateMsg = JSON.stringify({
        type: 'LATEST_STATE',
        req1: this.getVotes(1),
        req2: this.getVotes(2),
        req3: this.getVotes(3),
        timestamp: Date.now()
      });
      this.client.publish(TOPIC_STATE, stateMsg, { qos: 1, retain: true });
    },

    triggerUIUpdate(section, slotIndex) {
      if (window.pianoApp) {
        if (section === 1 && typeof window.pianoApp.updateAllRequestSlots === 'function') {
          window.pianoApp.updateAllRequestSlots();
        } else if (section === 2 && typeof window.pianoApp.updateAllRequest2Slots === 'function') {
          window.pianoApp.updateAllRequest2Slots();
        } else if (section === 3 && typeof window.pianoApp.updateAllRequest3Slots === 'function') {
          window.pianoApp.updateAllRequest3Slots();
        }
      }

      const prefix = section === 2 ? 'request2' : (section === 3 ? 'request3' : 'request');
      const countEl = document.getElementById(`${prefix}CountNum${slotIndex}`);
      if (countEl) {
        countEl.classList.remove('count-pop');
        void countEl.offsetWidth;
        countEl.classList.add('count-pop');
        setTimeout(() => countEl.classList.remove('count-pop'), 250);
      }
    },

    triggerAllUIUpdates(specificSec) {
      if (!window.pianoApp) return;
      if (!specificSec || specificSec === 1) {
        if (typeof window.pianoApp.updateAllRequestSlots === 'function') window.pianoApp.updateAllRequestSlots();
      }
      if (!specificSec || specificSec === 2) {
        if (typeof window.pianoApp.updateAllRequest2Slots === 'function') window.pianoApp.updateAllRequest2Slots();
      }
      if (!specificSec || specificSec === 3) {
        if (typeof window.pianoApp.updateAllRequest3Slots === 'function') window.pianoApp.updateAllRequest3Slots();
      }
    },

    hookAppVotes() {
      const self = this;
      if (typeof window.PianoCinemaApp !== 'undefined') {
        const proto = window.PianoCinemaApp.prototype;

        const origVote1 = proto.handleRequestVote;
        proto.handleRequestVote = function(slotIndex) {
          const res = origVote1.apply(this, arguments);
          try {
            const votes = self.getVotes(1);
            const count = votes[slotIndex - 1] || 0;
            self.broadcastVote(1, slotIndex, count, votes);
          } catch (e) {}
          return res;
        };

        const origVote2 = proto.handleRequest2Vote;
        proto.handleRequest2Vote = function(slotIndex) {
          const res = origVote2.apply(this, arguments);
          try {
            const votes = self.getVotes(2);
            const count = votes[slotIndex - 1] || 0;
            self.broadcastVote(2, slotIndex, count, votes);
          } catch (e) {}
          return res;
        };

        const origVote3 = proto.handleRequest3Vote;
        proto.handleRequest3Vote = function(slotIndex) {
          const res = origVote3.apply(this, arguments);
          try {
            const votes = self.getVotes(3);
            const count = votes[slotIndex - 1] || 0;
            self.broadcastVote(3, slotIndex, count, votes);
          } catch (e) {}
          return res;
        };
      }

      if (window.pianoApp) {
        const bindInstance = (fnName, sec) => {
          if (typeof window.pianoApp[fnName] === 'function' && !window.pianoApp[fnName]._rtHooked) {
            const orig = window.pianoApp[fnName];
            window.pianoApp[fnName] = function(slotIndex) {
              const res = orig.apply(this, arguments);
              try {
                const votes = self.getVotes(sec);
                const count = votes[slotIndex - 1] || 0;
                self.broadcastVote(sec, slotIndex, count, votes);
              } catch (e) {}
              return res;
            };
            window.pianoApp[fnName]._rtHooked = true;
          }
        };
        bindInstance('handleRequestVote', 1);
        bindInstance('handleRequest2Vote', 2);
        bindInstance('handleRequest3Vote', 3);
      }
    },

    hookAdminResets() {
      const self = this;
      const bindBtn = (btnId, sec) => {
        const btn = document.getElementById(btnId);
        if (btn && !btn.dataset.rtResetBound) {
          btn.dataset.rtResetBound = 'true';
          btn.addEventListener('click', () => {
            setTimeout(() => {
              self.broadcastReset(sec);
            }, 150);
          });
        }
      };
      bindBtn('btnResetRequestVotes', 1);
      bindBtn('btnResetRequest2Votes', 2);
      bindBtn('btnResetRequest3Votes', 3);
    }
  };

  window.GlobalRealtimeSync = GlobalRealtimeSync;

  function boot() {
    GlobalRealtimeSync.init();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }

  window.addEventListener('load', () => {
    GlobalRealtimeSync.hookAppVotes();
    GlobalRealtimeSync.hookAdminResets();
    GlobalRealtimeSync.requestInitialSync();
  });

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) {
      GlobalRealtimeSync.requestInitialSync();
    }
  });
})();
