using UnityEngine;

namespace VelocityZero.Data
{
    [CreateAssetMenu(menuName = "VelocityZero/AnchorConfig", fileName = "AnchorConfig")]
    public class AnchorConfig : ScriptableObject
    {
        [Header("Speed Curve — V(t) = Vbase + Amax*(1 - e^(-t/Tau))")]
        [Tooltip("Starting speed if no anchor selected (km/h)")]
        public float BaseStartSpeed   = 60f;

        [Tooltip("Maximum additional speed the formula can reach (km/h)")]
        public float Amax             = 280f;

        [Tooltip("Time constant — lower = faster acceleration")]
        public float Tau              = 120f;

        [Header("World Scale")]
        [Tooltip("Multiplier to convert km/h to Unity units/second")]
        public float SpeedToWorldScale = 0.05f;

        [Header("Zone")]
        [Tooltip("Speed delta above current max to trigger Zone mood (km/h)")]
        public float ZoneActivationDelta  = 0f; // 0 = auto fills via energy
        [Tooltip("Speed multiplier while Zone is active")]
        public float ZoneSpeedMultiplier  = 1.15f;

        [Header("Anchor Thresholds (km/h) — sorted ascending")]
        [Tooltip("Speed values that unlock a permanent anchor when reached")]
        public float[] AnchorThresholds = {
            80f, 100f, 120f, 140f, 160f, 180f,
            200f, 220f, 240f, 260f, 280f, 300f
        };
    }
}
