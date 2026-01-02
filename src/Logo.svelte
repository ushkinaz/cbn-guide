<script lang="ts">
import { getVersionedBasePath } from "./routing";

//https://patorjk.com/software/taag/#p=display&f=Poison&t=Don%27t%0APanic%21&x=none&v=4&h=0&w=80&we=false
const asciiArt = `
   @@@@@@@    @@@@@@   @@@  @@@  @@@  @@@@@@@
   @@@@@@@@  @@@@@@@@  @@@@ @@@   @@  @@@@@@@
   @@!  @@@  @@!  @@@  @@!@!@@@  @!     @@!
   !@!  @!@  !@!  @!@  !@!!@!@!         !@!
   @!@  !@!  @!@  !@!  @!@ !!@!         @!!
   !@!  !!!  !@!  !!!  !@!  !!!         !!!
   !!:  !!!  !!:  !!!  !!:  !!!         !!:
   :!:  !:!  :!:  !:!  :!:  !:!         :!:
    :::: ::  ::::: ::   ::   ::          ::
   :: :  :    : :  :   ::    :           :


   @@@@@@@    @@@@@@   @@@  @@@  @@@   @@@@@@@  @@@
   @@@@@@@@  @@@@@@@@  @@@@ @@@  @@@  @@@@@@@@  @@@
   @@!  @@@  @@!  @@@  @@!@!@@@  @@!  !@@       @@!
   !@!  @!@  !@!  @!@  !@!!@!@!  !@!  !@!       !@
   @!@@!@!   @!@!@!@!  @!@ !!@!  !!@  !@!       @!@
   !!@!!!    !!!@!!!!  !@!  !!!  !!!  !!!       !!!
   !!:       !!:  !!!  !!:  !!!  !!:  :!!
   :!:       :!:  !:!  :!:  !:!  :!:  :!:       :!:
    ::       ::   :::   ::   ::   ::   ::: :::   ::
    :         :   : :  ::    :   :     :: :: :  :::
`;

//
const asciiArtSmall = `
@@@@@@@   @@@@@@  @@@  @@@ @@@ @@@@@@@
@@!  @@@ @@!  @@@ @@!@!@@@ !@    @!!
@!@  !@! @!@  !@! @!@@!!@!       @!!
!!:  !!! !!:  !!! !!:  !!!       !!:
:: :  :   : :. :  ::    :         :


@@@@@@@   @@@@@@  @@@  @@@ @@@  @@@@@@@ @@@
@@!  @@@ @@!  @@@ @@!@!@@@ @@! !@@      @@@
@!@@!@!  @!@!@!@! @!@@!!@! !!@ !@!      !@!
!!:      !!:  !!! !!:  !!! !!: :!!
 :        :   : : ::    :  :    :: :: : :.:
`;
</script>

<a href="{getVersionedBasePath()}item/towel" class="logo-link">
  <aside class="ascii-art-container large">
    <pre class="ascii-art">{asciiArt}</pre>
  </aside>
  <aside class="ascii-art-container small">
    <pre class="ascii-art">{asciiArtSmall}</pre>
  </aside>
</a>

<style>
.ascii-art {
  font-family: Menlo, Monaco, Consolas, "Courier New", monospace;
  font-size: 8px;
  line-height: 0.9;
  color: var(--cata-color-light_cyan);
  background: transparent;
  border: none;
  margin: 0;
  padding: 0;
  white-space: pre;
}

.logo-link:hover {
  text-decoration: none;
}

.ascii-art-container {
  margin-bottom: 1em;
  margin-left: 1em;
  float: right;
}

@media (max-width: 400px) {
  .ascii-art-container.large {
    display: none;
  }
}

@media (min-width: 401px) {
  .ascii-art-container.small {
    display: none;
  }
}
</style>
