using UnityEngine;
using VelocityZero.Core;

namespace VelocityZero.Systems
{
    public class EconomyManager : MonoBehaviour
    {
        public static EconomyManager Instance { get; private set; }

        private const string SparksKey = "VZ_Sparks";
        private const string CoresKey  = "VZ_Cores";

        public int Sparks { get; private set; }
        public int Cores  { get; private set; }

        private void Awake()
        {
            if (Instance != null) { Destroy(gameObject); return; }
            Instance = this;
            Sparks = PlayerPrefs.GetInt(SparksKey, 0);
            Cores  = PlayerPrefs.GetInt(CoresKey,  0);
        }

        public bool TrySpendSparks(int amount)
        {
            if (Sparks < amount) return false;
            Sparks -= amount;
            Save();
            BroadcastCurrency();
            return true;
        }

        public bool TrySpendCores(int amount)
        {
            if (Cores < amount) return false;
            Cores -= amount;
            Save();
            BroadcastCurrency();
            return true;
        }

        public void AddSparks(int amount)
        {
            Sparks += amount;
            Save();
            BroadcastCurrency();
        }

        public void AddCores(int amount)
        {
            Cores += amount;
            Save();
            BroadcastCurrency();
        }

        private void Save()
        {
            PlayerPrefs.SetInt(SparksKey, Sparks);
            PlayerPrefs.SetInt(CoresKey,  Cores);
            PlayerPrefs.Save();
        }

        private void BroadcastCurrency()
        {
            EventBus.Publish(new OnCurrencyChanged { Sparks = Sparks, Cores = Cores });
        }
    }
}
