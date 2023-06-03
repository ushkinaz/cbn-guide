<script lang="ts">
export let obj: any;
export let buildNumber: string | undefined;
</script>

<pre>{JSON.stringify(
    obj,
    (key, value) => (key === "__filename" ? undefined : value),
    2
  )}</pre>
{#if obj.__filename}
  <a
    href={`https://github.com/cataclysmbnteam/Cataclysm-BN/blob/${
      buildNumber ?? "upload"
    }/${obj.__filename}`}
    target="_blank">View</a>
  /
  <a
    href={`https://github.dev/cataclysmbnteam/Cataclysm-BN/blob/${
      buildNumber ?? "upload"
    }/${obj.__filename}`}
    target="_blank">Edit on GitHub</a>
{/if}
