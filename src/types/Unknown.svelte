<script lang="ts">
interface Props {
  item: unknown;
}

let { item }: Props = $props();
</script>

<pre>{JSON.stringify(item, null, 2)}</pre>
