<script lang="ts">
  import Button from '../Button.svelte';
  import AppText from './AppText.svelte';

  const { title, objectives, onAccept, onDecline } = $props<{
    title: string;
    objectives: string[];
    onAccept: () => void;
    onDecline: () => void;
  }>();
</script>

<div class="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
  <div class="bg-zinc-900 rounded-lg p-6 max-w-md w-full mx-4 border border-zinc-700 shadow-xl">
    <div class="mb-6">
      <h2 class="text-2xl font-bold text-white mb-2">New Quest Available!</h2>
      <h3 class="text-xl text-white mb-4">{title}</h3>

      <div class="mb-6">
        <h4 class="text-lg font-semibold text-white mb-2">Quest Objectives</h4>
        <ul class="list-disc pl-5 space-y-2">
          {#each objectives as objective}
            <li class="text-zinc-300">
              <AppText text={objective} />
            </li>
          {/each}
        </ul>
      </div>
    </div>

    <div class="flex gap-4">
      <Button onclick={onDecline} variant="secondary" behavior="none" class="flex-1">
        Decline
      </Button>
      <Button onclick={onAccept} variant="green" behavior="none" class="flex-1">
        Accept Quest
      </Button>
    </div>
  </div>
</div>
<div
  class="bg-emerald-600 text-white border-2 hover:bg-white border-emerald-600 hover:border-emerald-600 hidden">
</div>
