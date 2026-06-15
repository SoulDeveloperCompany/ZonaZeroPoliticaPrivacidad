using System;
using System.IO;
using UnityEngine;

namespace VelocityZero.Systems
{
    /// <summary>
    /// Serializes game state to JSON on local disk + PlayerPrefs fallback.
    /// Call SaveManager.Instance.Save() any time you need to persist.
    /// </summary>
    public class SaveManager : MonoBehaviour
    {
        public static SaveManager Instance { get; private set; }

        private const string FileName = "velocity_save.json";
        private string _savePath;

        [Serializable]
        private class SaveData
        {
            public int   Sparks;
            public int   Cores;
            public int   AccountLevel;
            public int   AccountXP;
            public long  BestScore;
            public string[] UnlockedCharacters;
            public string[] UnlockedWorlds;
            public float[]  Anchors;
            public int   PrestigeLevel;
            public int   ConsecutiveLoginDays;
            public string LastLoginDate;
        }

        private SaveData _data = new();

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
            DontDestroyOnLoad(gameObject);
            _savePath = Path.Combine(Application.persistentDataPath, FileName);
            Load();
        }

        private void OnApplicationPause(bool pausing) { if (pausing) Save(); }
        private void OnApplicationQuit()              { Save(); }

        public void Save()
        {
            try
            {
                if (EconomyManager.Instance != null)
                {
                    _data.Sparks = EconomyManager.Instance.Sparks;
                    _data.Cores  = EconomyManager.Instance.Cores;
                }
                if (ScoreManager.Instance != null)
                {
                    _data.BestScore = ScoreManager.Instance.BestScore;
                }

                string json = JsonUtility.ToJson(_data, prettyPrint: false);
                File.WriteAllText(_savePath, json);
            }
            catch (Exception e)
            {
                Debug.LogError($"[SaveManager] Save failed: {e.Message}");
            }
        }

        private void Load()
        {
            try
            {
                if (!File.Exists(_savePath)) return;
                string json = File.ReadAllText(_savePath);
                _data = JsonUtility.FromJson<SaveData>(json) ?? new SaveData();
            }
            catch (Exception e)
            {
                Debug.LogError($"[SaveManager] Load failed: {e.Message}");
                _data = new SaveData();
            }
        }

        // ---- Accessors (used during system initialization) ----

        public int    GetSavedSparks()  => _data.Sparks;
        public int    GetSavedCores()   => _data.Cores;
        public long   GetBestScore()    => _data.BestScore;
        public int    GetPrestige()     => _data.PrestigeLevel;
        public int    GetAccountLevel() => _data.AccountLevel;
    }
}
