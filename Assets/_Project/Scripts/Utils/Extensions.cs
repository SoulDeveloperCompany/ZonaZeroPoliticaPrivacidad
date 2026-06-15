using UnityEngine;

namespace VelocityZero.Utils
{
    public static class Extensions
    {
        public static float Remap(this float value, float from1, float to1, float from2, float to2)
            => (value - from1) / (to1 - from1) * (to2 - from2) + from2;

        public static void SetAlpha(this CanvasGroup group, float alpha)
        {
            group.alpha          = alpha;
            group.interactable   = alpha > 0.5f;
            group.blocksRaycasts = alpha > 0.5f;
        }
    }
}
