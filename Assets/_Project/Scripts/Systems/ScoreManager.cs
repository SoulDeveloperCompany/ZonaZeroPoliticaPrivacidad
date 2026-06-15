using UnityEngine;
using VelocityZero.Core;

namespace VelocityZero.Systems
{
    /// <summary>
    /// Score = (Distance * SpeedFactor + Bonus) * ComboMult * ZoneMult
    /// </summary>
    public class ScoreManager : MonoBehaviour
    {
        public static ScoreManager Instance { get; private set; }

        [SerializeField] private float _scorePerMeter = 1f;
        [SerializeField] private long  _nearMissBonus = 50;

        public long   CurrentScore   { get; private set; }
        public long   BestScore      { get; private set; }
        public float  DistanceTravelled { get; private set; }

        private bool  _running;
        private const string BestScoreKey = "VZ_BestScore";

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
            BestScore = PlayerPrefs.GetInt(BestScoreKey, 0);
        }

        private void OnEnable()
        {
            EventBus.Subscribe<OnRunStarted>(OnRunStarted);
            EventBus.Subscribe<OnNearMiss>(OnNearMiss);
            EventBus.Subscribe<OnPlayerDied>(OnPlayerDied);
        }

        private void OnDisable()
        {
            EventBus.Unsubscribe<OnRunStarted>(OnRunStarted);
            EventBus.Unsubscribe<OnNearMiss>(OnNearMiss);
            EventBus.Unsubscribe<OnPlayerDied>(OnPlayerDied);
        }

        private void OnRunStarted(OnRunStarted _)
        {
            CurrentScore      = 0;
            DistanceTravelled = 0f;
            _running          = true;
        }

        private void OnNearMiss(OnNearMiss _)
        {
            AddScore(_nearMissBonus);
        }

        private void OnPlayerDied(OnPlayerDied _)
        {
            _running = false;
            if (CurrentScore > BestScore)
            {
                BestScore = CurrentScore;
                PlayerPrefs.SetInt(BestScoreKey, (int)Mathf.Min(CurrentScore, int.MaxValue));
                PlayerPrefs.Save();
            }
        }

        private void Update()
        {
            if (!_running || SpeedManager.Instance == null) return;

            float speed  = SpeedManager.Instance.GetObstacleSpeed();
            float combo  = ComboSystem.Instance != null ? ComboSystem.Instance.Multiplier : 1f;
            float zone   = ZoneSystem.Instance  != null ? ZoneSystem.Instance.ScoreMultiplier : 1f;

            float delta  = speed * _scorePerMeter * combo * zone * Time.deltaTime;
            DistanceTravelled += speed * Time.deltaTime;

            AddScore((long)delta);
        }

        private void AddScore(long amount)
        {
            CurrentScore += amount;
            EventBus.Publish(new OnScoreChanged { Score = CurrentScore });
        }

        public int ComputeSparksEarned(float comboAvg, int zoneCount)
        {
            return Mathf.FloorToInt(
                (DistanceTravelled / 10f) * comboAvg * (1f + 0.25f * zoneCount));
        }
    }
}
