using UnityEngine;
using VelocityZero.Core;
using VelocityZero.Systems;

namespace VelocityZero.Gameplay
{
    /// <summary>
    /// Listens for player death, builds RunResult, and triggers EndRun on GameManager.
    /// </summary>
    public class RunController : MonoBehaviour
    {
        private void OnEnable()
        {
            EventBus.Subscribe<OnPlayerDied>(OnPlayerDied);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<OnPlayerDied>(OnPlayerDied);
        }

        private void OnPlayerDied(OnPlayerDied _)
        {
            var speed  = SpeedManager.Instance;
            var score  = ScoreManager.Instance;
            var combo  = ComboSystem.Instance;
            var zone   = ZoneSystem.Instance;
            var eco    = EconomyManager.Instance;

            float comboAvg = combo?.Multiplier ?? 1f;
            int   zoneCount = zone?.ActivationCount ?? 0;
            int   sparks   = score?.ComputeSparksEarned(comboAvg, zoneCount) ?? 0;

            var result = new RunResult
            {
                MaxSpeed         = speed?.MaxSpeedThisRun ?? 0f,
                Distance         = score?.DistanceTravelled ?? 0f,
                Score            = score?.CurrentScore ?? 0,
                MaxCombo         = combo?.MaxCombo ?? 0,
                ZoneActivations  = zoneCount,
                SparksEarned     = sparks,
                XpEarned         = Mathf.RoundToInt(sparks * 0.5f),
                NewRecord        = (score?.CurrentScore ?? 0) > (score?.BestScore ?? 0),
                NewAnchorSpeed   = 0f // AnchorSystem sets this in StopRun
            };

            // Award sparks
            eco?.AddSparks(sparks);

            GameManager.Instance?.EndRun(result);
        }
    }
}
