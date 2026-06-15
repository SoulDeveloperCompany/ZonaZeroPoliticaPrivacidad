using System;
using System.Collections.Generic;
using UnityEngine;

namespace VelocityZero.Core
{
    /// <summary>
    /// Decoupled event system. Subscribe/Publish without direct references.
    /// </summary>
    public static class EventBus
    {
        private static readonly Dictionary<Type, List<Delegate>> _handlers = new();

        public static void Subscribe<T>(Action<T> handler)
        {
            var type = typeof(T);
            if (!_handlers.ContainsKey(type))
                _handlers[type] = new List<Delegate>();
            _handlers[type].Add(handler);
        }

        public static void Unsubscribe<T>(Action<T> handler)
        {
            var type = typeof(T);
            if (_handlers.TryGetValue(type, out var list))
                list.Remove(handler);
        }

        public static void Publish<T>(T eventData)
        {
            var type = typeof(T);
            if (!_handlers.TryGetValue(type, out var list)) return;

            for (int i = list.Count - 1; i >= 0; i--)
            {
                try { ((Action<T>)list[i])?.Invoke(eventData); }
                catch (Exception e) { Debug.LogError($"[EventBus] {e}"); }
            }
        }

        public static void Clear() => _handlers.Clear();
    }

    // ---- Event structs ----

    public struct OnGameStateChanged    { public GameState NewState; }
    public struct OnRunStarted          { public float StartSpeed; }
    public struct OnRunEnded            { public RunResult Result; }
    public struct OnSpeedChanged        { public float Speed; public float NormalizedProgress; }
    public struct OnAnchorUnlocked      { public float AnchorSpeed; }
    public struct OnZoneStateChanged    { public ZoneState State; }
    public struct OnZoneEnergyChanged   { public float Normalized; }
    public struct OnPlayerDied          { }
    public struct OnComboChanged        { public int Combo; public float Multiplier; }
    public struct OnNearMiss            { public int Current; }
    public struct OnScoreChanged        { public long Score; }
    public struct OnCurrencyChanged     { public int Sparks; public int Cores; }
    public struct OnCollectiblePickup   { public PowerUpType Type; }
    public struct OnLaneChanged         { public LaneIndex From; public LaneIndex To; }

    public struct RunResult
    {
        public float MaxSpeed;
        public float Distance;
        public long  Score;
        public int   MaxCombo;
        public int   ZoneActivations;
        public int   SparksEarned;
        public int   XpEarned;
        public bool  NewRecord;
        public float NewAnchorSpeed; // 0 if none
    }
}
